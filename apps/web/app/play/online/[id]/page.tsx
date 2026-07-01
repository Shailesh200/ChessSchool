"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import type { Realtime as AblyRealtime } from "ably";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
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
  seatToken?: string;
  error?: string;
}

function fmtClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
}

const JOIN_WINDOW_MS = 3 * 60 * 1000;

export default function OnlineSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [boardBox, boardSize] = useSquareSize();
  const [session, setSession] = useState<SessionState | null>(null);
  const [color, setColor] = useState<"w" | "b" | "spectator" | null>(null);
  const [seatToken, setSeatToken] = useState<string | null>(null);
  const [resignOpen, setResignOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(0);
  const flagged = useRef(false);
  // Optimistic move (shown instantly while the server confirms) + connection state.
  const [optimistic, setOptimistic] = useState<{ fen: string; from: string; to: string; prevFen: string } | null>(null);
  const [online, setOnline] = useState(true);
  const sigRef = useRef(""); // skip re-renders when the polled state is unchanged
  const savedRef = useRef(false); // save the finished game to history once
  const optimisticRef = useRef<typeof optimistic>(null);
  const lastUpdatedRef = useRef(0); // newest server updatedAt we've applied (drop stale)
  useEffect(() => {
    optimisticRef.current = optimistic;
  }, [optimistic]);
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
    const tokenKey = `${key}.token`;
    const stored = localStorage.getItem(key);
    if (stored === "w" || stored === "b") {
      Promise.resolve().then(() => {
        setSeatToken(localStorage.getItem(tokenKey));
        setColor(stored);
      });
      return;
    }
    fetch(`/api/session/${id}?join=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SessionState | null) => {
        if (!s || s.error) return;
        const seat = s.claimed ? "b" : "spectator";
        setColor(seat);
        if (seat === "b") {
          localStorage.setItem(key, "b");
          if (s.seatToken) {
            localStorage.setItem(tokenKey, s.seatToken);
            setSeatToken(s.seatToken);
          }
        }
        setSession(s);
      })
      .catch(() => void 0);
  }, [id]);

  // Apply a fresh state from either source (poll or realtime), de-duped so an
  // in-progress click-to-move selection isn't reset on no-op updates (#2).
  const applyState = useCallback((s: SessionState) => {
    setOnline(true);
    // Drop stale updates older than what we've already applied (out-of-order
    // poll/push races) — but always allow terminal states through.
    if (s.status !== "over" && s.updatedAt && s.updatedAt < lastUpdatedRef.current) return;
    const opt = optimisticRef.current;
    // While our move is pending, ignore any state still showing the pre-move
    // position (a poll/push that left before the server saw our move) — this is
    // what used to snap the move away until the POST returned.
    if (opt && s.fen === opt.prevFen && s.status !== "over") return;
    if (opt) setOptimistic(null); // server has advanced past our move
    lastUpdatedRef.current = Math.max(lastUpdatedRef.current, s.updatedAt || 0);
    const sig = `${s.fen}|${s.turn}|${s.status}|${s.result}|${s.blackJoined}|${s.whiteMs}|${s.blackMs}`;
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setSession(s);
    }
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
    // Sound the result from this player's perspective.
    audio.play(winner === null ? "notify" : winner === color ? "victory" : "fail");
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

  const onMove = useCallback(
    (move: MoveInput): boolean => {
      if (!session || color === "spectator" || color === null || !seatToken) return false;
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
      setOptimistic({ fen: g.fen(), from: move.from, to: move.to, prevFen: session.fen });
      audio.play(applied.captured ? "capture" : "move");
      if (g.inCheck()) audio.play("check");
      fetch(`/api/session/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "move", color, seatToken, from: move.from, to: move.to, promotion: move.promotion }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: SessionState | null) => {
          if (s && !s.error) applyState(s); // authoritative post-move state clears the optimistic overlay
          else setOptimistic(null); // server rejected → revert to the live state
        })
        .catch(() => setOptimistic(null));
      return true; // keep the piece where the player dropped it
    },
    [session, color, seatToken, optimistic, id, applyState],
  );

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
      body: JSON.stringify({ action: "resign", color, seatToken }),
    }).then(() => void 0);
  }

  const waiting = session?.status === "waiting";
  const myTurn =
    session?.status === "active" && (color === "w" || color === "b") && session?.turn === color;
  const canMove = !!myTurn && !optimistic; // lock the board once a move is in flight
  const orientation = color === "b" ? "black" : "white";
  const boardFen = optimistic?.fen ?? session?.fen ?? "";
  const lastFrom = optimistic ? optimistic.from : session?.lastFrom ?? null;
  const lastTo = optimistic ? optimistic.to : session?.lastTo ?? null;

  // Memoize the board so background re-renders (clock tick, deduped polls) don't
  // re-render it mid-interaction — that was occasionally dropping a click/tap.
  const boardEl = useMemo(() => {
    if (!boardFen) return null;
    const last = lastFrom && lastTo ? { from: lastFrom as never, to: lastTo as never } : null;
    return (
      <ChessBoard fen={boardFen} orientation={orientation} onMove={onMove} lastMove={last} interactive={canMove} />
    );
  }, [boardFen, orientation, onMove, lastFrom, lastTo, canMove]);

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
      body: JSON.stringify({ action: "timeout", color: flag, seat: colorRef.current, seatToken }),
    }).catch(() => void 0);
  }, [active, hasClock, wMs, bMs, id]);

  const myClock = color === "b" ? bMs : wMs;
  const oppClock = color === "b" ? wMs : bMs;

  // Outcome from this player's perspective, for the game-over overlay.
  const gameOver = (() => {
    if (session?.status !== "over") return null;
    const res = session.result ?? "1/2-1/2";
    let winner: "w" | "b" | null = null;
    let reason = "";
    if (res.startsWith("resign:")) { winner = res.endsWith("w") ? "b" : "w"; reason = "by resignation"; }
    else if (res.startsWith("time:")) { winner = res.endsWith("w") ? "w" : "b"; reason = "on time ⏱️"; }
    else if (res === "1-0") { winner = "w"; reason = "checkmate"; }
    else if (res === "0-1") { winner = "b"; reason = "checkmate"; }
    const me = color === "w" || color === "b" ? color : null;
    const draw = winner === null;
    const win = !!me && winner === me;
    const text = draw
      ? "Draw"
      : reason === "checkmate"
        ? win ? "Checkmate — you win! 🏆" : "Checkmate — you lose"
        : !me
          ? `${winner === "w" ? "White" : "Black"} wins ${reason}`
          : win
            ? `You win ${reason}`
            : `You lose ${reason}`;
    return { text, win, draw };
  })();

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
        <div className="relative" style={{ width: boardSize || undefined, height: boardSize || undefined }}>
          {boardEl}
          {gameOver && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-ink/45 backdrop-blur-sm">
              {gameOver.win && <Confetti />}
              <div className="rounded-card bg-surface-card px-7 py-6 text-center [box-shadow:var(--shadow-pop)]">
                <div className="text-xl font-extrabold text-ink">{gameOver.text}</div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => router.push(`/review/${id}`)}>
                    Review
                  </Button>
                  <Button size="sm" onClick={() => router.push("/play")}>
                    New game
                  </Button>
                </div>
              </div>
            </div>
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
