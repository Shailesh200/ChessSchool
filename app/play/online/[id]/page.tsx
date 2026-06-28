"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Realtime as AblyRealtime } from "ably";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BackButton } from "@/components/ui/BackButton";
import { useSquareSize } from "@/core/hooks/useSquareSize";
import { toast } from "@/core/store/toast.store";
import { audio } from "@/core/audio/audioEngine";
import { saveGame, type EndReason } from "@/core/db/db";
import type { MoveInput } from "@/core/types/chess";

interface SessionState {
  id: string;
  fen: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "over";
  result: string | null;
  blackJoined: number;
  pgn: string;
  lastFrom: string | null;
  lastTo: string | null;
  timeControlMin: number;
  whiteMs: number;
  blackMs: number;
  createdAt: number;
  updatedAt: number;
  claimed?: boolean;
  error?: string;
}

function fmtClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
}

const JOIN_WINDOW_MS = 3 * 60 * 1000;

export default function OnlineSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [boardBox, boardSize] = useSquareSize();
  const [session, setSession] = useState<SessionState | null>(null);
  const [color, setColor] = useState<"w" | "b" | "spectator" | null>(null);
  const [resignOpen, setResignOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(0);
  const flagged = useRef(false);
  // Optimistic move (shown instantly while the server confirms) + connection state.
  const [optimistic, setOptimistic] = useState<{ fen: string; from: string; to: string } | null>(null);
  const [online, setOnline] = useState(true);
  const sigRef = useRef(""); // skip re-renders when the polled state is unchanged
  const savedRef = useRef(false); // save the finished game to history once
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  // Tick for the live clock countdown — only while a clock is actually running,
  // so we don't re-render the board 4x/second (and disturb clicks) otherwise.
  const tickRef = useRef(false);
  useEffect(() => {
    tickRef.current = !!(session && session.timeControlMin > 0 && session.status === "active");
  }, [session]);
  useEffect(() => {
    const iv = setInterval(() => {
      if (tickRef.current) setNow(Date.now());
    }, 250);
    return () => clearInterval(iv);
  }, []);

  // Determine my seat (creator stored "w"; first opener claims "b").
  useEffect(() => {
    const key = `chessschool.online.${id}`;
    const stored = localStorage.getItem(key);
    if (stored === "w" || stored === "b") {
      Promise.resolve().then(() => setColor(stored));
      return;
    }
    fetch(`/api/session/${id}?join=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SessionState | null) => {
        if (!s || s.error) return;
        const seat = s.claimed ? "b" : "spectator";
        setColor(seat);
        if (seat === "b") localStorage.setItem(key, "b");
        setSession(s);
      })
      .catch(() => void 0);
  }, [id]);

  // Apply a fresh state from either source (poll or realtime), de-duped so an
  // in-progress click-to-move selection isn't reset on no-op updates (#2).
  const applyState = useCallback((s: SessionState) => {
    setOnline(true);
    const sig = `${s.fen}|${s.turn}|${s.status}|${s.result}|${s.blackJoined}|${s.whiteMs}|${s.blackMs}`;
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setSession(s);
    }
    if (s.status === "over" || s.turn === colorRef.current) setOptimistic(null);
    if (s.status === "waiting" && s.blackJoined === 0 && Date.now() - s.createdAt > JOIN_WINDOW_MS) {
      setExpired(true);
    }
  }, []);

  // Realtime push via Ably (instant). Falls back silently to polling if Ably
  // isn't configured (token endpoint 503s) or the connection fails.
  const ablyRef = useRef(false);
  useEffect(() => {
    let client: AblyRealtime | null = null;
    let cancelled = false;
    // Probe first so we don't load the Ably bundle / connect when it's not set up.
    void fetch("/api/ably-token")
      .then((r) => (r.ok ? import("ably") : null))
      .then((mod) => {
        if (!mod || cancelled) return;
        const { Realtime } = mod;
        client = new Realtime({ authUrl: "/api/ably-token", autoConnect: true });
        client.connection.on("connected", () => { ablyRef.current = true; });
        client.connection.on("failed", () => { ablyRef.current = false; });
        client.connection.on("disconnected", () => { ablyRef.current = false; });
        client.channels.get(`game:${id}`).subscribe("state", (msg) => {
          if (msg?.data) applyState(msg.data as SessionState);
        });
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
      try {
        client?.close();
      } catch {
        /* ignore */
      }
    };
  }, [id, applyState]);

  // Poll: fast while waiting on the opponent, but just a slow backstop once
  // realtime is connected.
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = () =>
      fetch(`/api/session/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s: SessionState | null) => {
          if (!alive) return;
          if (!s || s.error) {
            setOnline(false);
            t = setTimeout(tick, 2000);
            return;
          }
          applyState(s);
          const waitingOnOpponent = s.status === "active" && s.turn !== colorRef.current;
          const delay = ablyRef.current ? 5000 : waitingOnOpponent ? 650 : 1600;
          t = setTimeout(tick, delay);
        })
        .catch(() => {
          if (!alive) return;
          setOnline(false);
          t = setTimeout(tick, 2000);
        });
    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [id, applyState]);

  // Save a finished online game into the local match history (#3).
  useEffect(() => {
    if (!session || session.status !== "over" || savedRef.current || color === null || color === "spectator") return;
    savedRef.current = true;
    const res = session.result ?? "1/2-1/2";
    let winner: "w" | "b" | null = null;
    let endReason: EndReason = "draw";
    if (res.startsWith("resign:")) {
      winner = res.endsWith("w") ? "b" : "w";
      endReason = "resign";
    } else if (res.startsWith("time:")) {
      winner = res.endsWith("w") ? "w" : "b";
      endReason = "timeout";
    } else if (res === "1-0") {
      winner = "w";
      endReason = "checkmate";
    } else if (res === "0-1") {
      winner = "b";
      endReason = "checkmate";
    }
    let moveCount = 0;
    try {
      const g = new Chess();
      g.loadPgn(session.pgn ?? "");
      moveCount = g.history().length;
    } catch {
      /* ignore */
    }
    void saveGame({
      id: session.id,
      mode: "online",
      pgn: session.pgn ?? "",
      fen: session.fen,
      whiteName: color === "w" ? "You" : "Opponent",
      blackName: color === "b" ? "You" : "Opponent",
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turn: session.turn,
      result: winner === "w" ? "1-0" : winner === "b" ? "0-1" : "1/2-1/2",
      endReason,
      winner,
      moveCount,
      elo: null,
      durationMs: session.updatedAt - session.createdAt,
    });
  }, [session, color]);

  function onMove(move: MoveInput): boolean {
    if (!session || color === "spectator" || color === null) return false;
    if (session.status !== "active" || session.turn !== color || optimistic) return false;
    // Validate + apply locally first so the piece moves instantly (no snap-back).
    const g = new Chess(session.fen);
    let applied;
    try {
      applied = g.move({ from: move.from, to: move.to, promotion: (move.promotion as "q") ?? "q" });
    } catch {
      applied = null;
    }
    if (!applied) return false;
    setOptimistic({ fen: g.fen(), from: move.from, to: move.to });
    audio.play(applied.captured ? "capture" : "move");
    if (g.inCheck()) audio.play("check");
    fetch(`/api/session/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "move", color, from: move.from, to: move.to, promotion: move.promotion }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SessionState | null) => {
        setOptimistic(null); // server is now authoritative (or rejected → revert)
        if (s && !s.error) setSession(s);
      })
      .catch(() => setOptimistic(null));
    return true; // keep the piece where the player dropped it
  }

  function shareLink() {
    const url = `${window.location.origin}/play/online/${id}`;
    if (navigator.share) navigator.share({ title: "Join my chess game", url }).catch(() => void 0);
    else navigator.clipboard?.writeText(url).then(() => toast("Invite link copied", { icon: "check", tone: "success" }));
  }

  function resign() {
    setResignOpen(false);
    fetch(`/api/session/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "resign", color }),
    }).then(() => void 0);
  }

  const waiting = session?.status === "waiting";
  const myTurn =
    session?.status === "active" && (color === "w" || color === "b") && session?.turn === color;
  const canMove = !!myTurn && !optimistic; // lock the board once a move is in flight
  const orientation = color === "b" ? "black" : "white";
  const boardFen = optimistic?.fen ?? session?.fen ?? "";
  const boardLast = optimistic
    ? { from: optimistic.from as never, to: optimistic.to as never }
    : session?.lastFrom && session?.lastTo
      ? { from: session.lastFrom as never, to: session.lastTo as never }
      : null;

  // Live clocks: deduct elapsed from the side to move.
  const active = session?.status === "active";
  const hasClock = !!session && session.timeControlMin > 0;
  const elapsed = active && now && session ? Math.max(0, now - session.updatedAt) : 0;
  const wMs = session ? (active && session.turn === "w" ? session.whiteMs - elapsed : session.whiteMs) : 0;
  const bMs = session ? (active && session.turn === "b" ? session.blackMs - elapsed : session.blackMs) : 0;

  // Flag (claim a win on time) when a clock hits zero.
  useEffect(() => {
    if (!active || !hasClock || flagged.current) return;
    const flag = wMs <= 0 ? "w" : bMs <= 0 ? "b" : null;
    if (!flag) return;
    flagged.current = true;
    fetch(`/api/session/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "timeout", color: flag }),
    }).catch(() => void 0);
  }, [active, hasClock, wMs, bMs, id]);

  const myClock = color === "b" ? bMs : wMs;
  const oppClock = color === "b" ? wMs : bMs;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="pt-safe sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-hairline bg-surface/90 px-3 py-2 backdrop-blur">
        {/* No 'Leave' mid-game — you must resign to exit a live match. */}
        {session?.status === "active" && color !== "spectator" ? (
          <span className="w-16" />
        ) : (
          <BackButton fallback="/play" label="Leave" />
        )}
        <span className="text-sm font-extrabold text-ink">
          {color === "spectator" ? "Spectating" : `You are ${color === "b" ? "Black" : "White"}`}
        </span>
        {session && session.status !== "over" && color !== "spectator" ? (
          <Button size="sm" variant="danger" onClick={() => setResignOpen(true)}>Resign</Button>
        ) : (
          <span className="w-16" />
        )}
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pt-3 text-center">
        {expired ? (
          <p className="text-sm font-bold text-danger">No opponent joined in 3 minutes — start a new game.</p>
        ) : waiting ? (
          <div>
            <p className="text-sm font-extrabold text-ink">Waiting for an opponent…</p>
            <p className="text-xs font-semibold text-ink-500">Share the link — they have 3 minutes to join.</p>
            <Button size="sm" className="mt-2" onClick={shareLink}>🔗 Share invite link</Button>
          </div>
        ) : session?.status === "over" ? (
          <p className="text-sm font-extrabold text-ink">
            Game over —{" "}
            {session.result?.startsWith("resign")
              ? "by resignation"
              : session.result?.startsWith("time")
                ? "on time ⏱️"
                : session.result}
          </p>
        ) : (
          <p className="text-sm font-bold text-ink">
            {!online ? "🔌 Reconnecting…" : canMove ? "Your move" : optimistic ? "Move sent…" : "Opponent's move…"}
          </p>
        )}
      </div>

      {hasClock && session && session.status !== "waiting" && (
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-1">
          <span className="text-xs font-bold text-ink-500">Opponent</span>
          <span className={`rounded-lg px-2.5 py-1 font-mono text-base font-extrabold tabular-nums ${active && session.turn !== color ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"}`}>
            {fmtClock(oppClock)}
          </span>
        </div>
      )}

      <div ref={boardBox} className="flex min-h-0 flex-1 items-center justify-center px-3 py-2">
        <div style={{ width: boardSize || undefined, height: boardSize || undefined }}>
          {session && (
            <ChessBoard
              fen={boardFen}
              orientation={orientation}
              onMove={onMove}
              lastMove={boardLast}
              interactive={canMove}
            />
          )}
        </div>
      </div>

      {hasClock && session && session.status !== "waiting" && (
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pb-2">
          <span className="text-xs font-bold text-ink-500">You {color === "spectator" ? "(spectating)" : ""}</span>
          <span className={`rounded-lg px-2.5 py-1 font-mono text-base font-extrabold tabular-nums ${myTurn ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"}`}>
            {fmtClock(myClock)}
          </span>
        </div>
      )}

      <ConfirmDialog
        open={resignOpen}
        title="Resign this game?"
        confirmLabel="Resign"
        tone="danger"
        onConfirm={resign}
        onCancel={() => setResignOpen(false)}
      />
    </div>
  );
}
