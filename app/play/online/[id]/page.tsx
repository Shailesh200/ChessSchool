"use client";

import { use, useEffect, useState } from "react";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BackButton } from "@/components/ui/BackButton";
import { useSquareSize } from "@/core/hooks/useSquareSize";
import { toast } from "@/core/store/toast.store";
import { audio } from "@/core/audio/audioEngine";
import type { MoveInput } from "@/core/types/chess";

interface SessionState {
  id: string;
  fen: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "over";
  result: string | null;
  blackJoined: number;
  lastFrom: string | null;
  lastTo: string | null;
  createdAt: number;
  claimed?: boolean;
  error?: string;
}

const JOIN_WINDOW_MS = 3 * 60 * 1000;

export default function OnlineSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [boardBox, boardSize] = useSquareSize();
  const [session, setSession] = useState<SessionState | null>(null);
  const [color, setColor] = useState<"w" | "b" | "spectator" | null>(null);
  const [resignOpen, setResignOpen] = useState(false);
  const [expired, setExpired] = useState(false);

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

  // Poll for the latest state.
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch(`/api/session/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s: SessionState | null) => {
          if (!alive || !s || s.error) return;
          setSession(s);
          if (s.status === "waiting" && s.blackJoined === 0 && Date.now() - s.createdAt > JOIN_WINDOW_MS) {
            setExpired(true);
          }
        })
        .catch(() => void 0);
    tick();
    const iv = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id]);

  function onMove(move: MoveInput): boolean {
    if (!session || color === "spectator" || color === null) return false;
    if (session.status !== "active" || session.turn !== color) return false;
    fetch(`/api/session/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "move", color, from: move.from, to: move.to, promotion: move.promotion }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SessionState | null) => {
        if (s && !s.error) {
          setSession(s);
          audio.play("move");
        }
      })
      .catch(() => void 0);
    return false; // server is the source of truth; board updates from the response
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
  const orientation = color === "b" ? "black" : "white";

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="pt-safe sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-hairline bg-surface/90 px-3 py-2 backdrop-blur">
        <BackButton fallback="/play" label="Leave" />
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
            Game over — {session.result?.startsWith("resign") ? "by resignation" : session.result}
          </p>
        ) : (
          <p className="text-sm font-bold text-ink">{myTurn ? "Your move" : "Opponent's move…"}</p>
        )}
      </div>

      <div ref={boardBox} className="flex min-h-0 flex-1 items-center justify-center px-3 py-3">
        <div style={{ width: boardSize || undefined, height: boardSize || undefined }}>
          {session && (
            <ChessBoard
              fen={session.fen}
              orientation={orientation}
              onMove={onMove}
              lastMove={session.lastFrom && session.lastTo ? { from: session.lastFrom, to: session.lastTo } : null}
              interactive={!!myTurn}
            />
          )}
        </div>
      </div>

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
