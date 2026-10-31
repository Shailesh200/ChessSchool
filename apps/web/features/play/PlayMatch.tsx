"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { ChessBoard } from "@/features/board/ChessBoard";
import { useMatch } from "@/core/store/match.store";
import { useProgression } from "@/core/store/progression.store";
import { saveGame, type EndReason } from "@/core/db/db";
import { eloToConfig, getBotMove } from "@/features/chess-engine/bot";
import type { MoveInput } from "@/core/types/chess";
import { KitIcon } from "@/components/ui/KitIcon";
import { BOT_MATCH_WIN_XP } from "./matchReward";
import { PLAY_MATCH_BOARD } from "./matchBoardMarkup";
import { MATCH_FEN, MATCH_MOVES, opponentById, type OpponentId } from "./opponents";

type Scene = "kira" | "ash" | "rex" | "skye" | "dark" | "won" | "lost" | "live";

/** Wall clock for saved games. Kept outside render so the match screen stays pure. */
function nowMs() {
  return Date.now();
}

/** Next move number. Eight plies (through 4...Nf6) is move 5, White to play. */
function moveNumberLabel(sans: string[]): number {
  return Math.floor(sans.length / 2) + 1;
}

function headArt(scene: Scene, id: OpponentId): string {
  if (scene === "won") return "--head-rex-sad";
  if (scene === "lost") return "--head-skye-encouraging";
  if (scene === "ash" || id === "ash") return "--head-ash-neutral";
  if (scene === "rex" || id === "rex") return "--head-rex-neutral";
  if (scene === "skye" || id === "skye") return "--head-skye-thinking";
  return "--head-kira-happy";
}

function headMood(scene: Scene): string {
  if (scene === "won") return "happy";
  if (scene === "lost") return "sad";
  return "thinking";
}

const RESULT_FRAME: Record<"rex" | "skye", { g1: string; g2: string; acc: string }> = {
  rex: {
    g1: "#FBE6C4",
    g2: "#D9A441",
    acc: "var(--acc-rex-sad,var(--acc-retry))",
  },
  skye: {
    g1: "#EEDDF9",
    g2: "#D3A6EA",
    acc: "var(--acc-skye-encouraging,var(--acc-retry))",
  },
};

function CoachHead({
  art,
  size,
  name,
  coach,
  mood,
  hidden = false,
}: {
  art: string;
  size: string;
  name: string;
  coach: string;
  mood: string;
  hidden?: boolean;
}) {
  return (
    <span
      className="head"
      style={{ ["--art" as string]: `var(${art})`, ["--s" as string]: size }}
      role={hidden ? undefined : "img"}
      aria-label={hidden ? undefined : name}
      aria-hidden={hidden || undefined}
      data-coach={coach}
      data-mood={mood}
    />
  );
}

function sceneOpponent(scene: Scene): OpponentId {
  if (scene === "ash") return "ash";
  if (scene === "rex" || scene === "won") return "rex";
  if (scene === "skye" || scene === "lost") return "skye";
  return "kira";
}

function MoveList({ sans, current }: { sans: string[]; current?: boolean }) {
  const rows: { n: number; w: string; b: string; cur: "w" | "b" | null }[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    const last = i + 1 >= sans.length - (sans.length % 2 === 0 ? 0 : 1);
    rows.push({
      n: i / 2 + 1,
      w: sans[i] ?? "",
      b: sans[i + 1] ?? "",
      cur: !current
        ? null
        : i === sans.length - 1
          ? "w"
          : i + 1 === sans.length - 1
            ? "b"
            : last
              ? null
              : null,
    });
  }
  return (
    <div className="moves" style={{ marginTop: "0.6rem" }}>
      {rows.map((row) => (
        <span key={row.n} style={{ display: "contents" }}>
          <span className="n">{row.n}.</span>
          <span className={row.cur === "w" ? "cur" : undefined}>{row.w}</span>
          <span className={row.cur === "b" ? "cur" : undefined}>{row.b}</span>
        </span>
      ))}
    </div>
  );
}

export function PlayMatch({ scene = "live" }: { scene?: Scene }) {
  const active = useMatch((s) => s.active);
  const sync = useMatch((s) => s.sync);
  const clear = useMatch((s) => s.clear);
  const setEndSnapshot = useMatch((s) => s.setEndSnapshot);
  const awardXp = useProgression((s) => s.awardXp);
  const updateRating = useProgression((s) => s.updateRating);
  const fixture = scene !== "live";
  const [oppId] = useState<OpponentId>(() => {
    if (fixture) return sceneOpponent(scene);
    if (typeof window === "undefined") return "kira";
    const stored = sessionStorage.getItem("play-opponent");
    if (
      stored === "skye" ||
      stored === "kira" ||
      stored === "rex" ||
      stored === "ash"
    ) {
      return stored;
    }
    return "kira";
  });
  const [pass] = useState(() => {
    if (fixture) return false;
    if (active?.mode === "pass") return true;
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("play-mode") === "friend";
  });
  const opp = opponentById(oppId);

  const [game] = useState(
    () => new Chess(fixture ? MATCH_FEN : active?.fen || undefined),
  );
  const [fen, setFen] = useState(() =>
    fixture ? MATCH_FEN : (active?.fen ?? game.fen()),
  );
  const [sans, setSans] = useState<string[]>(() =>
    fixture ? MATCH_MOVES : game.history(),
  );
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<"win" | "loss" | null>(
    scene === "won" ? "win" : scene === "lost" ? "loss" : null,
  );
  const [line, setLine] = useState(
    scene === "won"
      ? "A rare defeat. We rise again."
      : scene === "lost"
        ? "Not your best stroke. Try again, darling."
        : opp.line,
  );
  const saved = useRef(false);

  useEffect(() => {
    if (scene !== "dark") return;
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = "dark";
    return () => {
      if (prev) root.dataset.theme = prev;
      else delete root.dataset.theme;
    };
  }, [scene]);

  async function finish(reason: EndReason, winner: "w" | "b" | null) {
    if (saved.current) return;
    saved.current = true;
    const playerWon = winner === "w";
    if (playerWon && !fixture) awardXp(BOT_MATCH_WIN_XP);
    if (!pass && active) {
      updateRating(active.targetElo, playerWon ? 1 : winner === null ? 0.5 : 0);
    }
    setOver(playerWon ? "win" : "loss");
    setLine(
      playerWon
        ? opp.id === "rex"
          ? "A rare defeat. We rise again."
          : "Clean. That's how you finish."
        : opp.id === "skye"
          ? "Not your best stroke. Try again, darling."
          : "Again. The position is still there.",
    );
    const text = playerWon ? `You beat ${opp.name}!` : `${opp.name} won this one`;
    setEndSnapshot({
      text,
      win: playerWon,
      ratingDelta: 0,
      newRating: useProgression.getState().rating,
      reason,
      mateReviewPending: false,
    });
    if (active) {
      await saveGame({
        id: active.id,
        mode: pass ? "pass" : "bot",
        pgn: game.pgn(),
        fen: game.fen(),
        whiteName: "You",
        blackName: pass ? "Friend" : opp.name,
        createdAt: active.createdAt,
        updatedAt: nowMs(),
        turn: game.turn(),
        result: winner === "w" ? "1-0" : winner === "b" ? "0-1" : "1/2-1/2",
        endReason: reason,
        winner,
        moveCount: game.history().length,
        elo: pass ? null : opp.elo,
        durationMs: nowMs() - active.createdAt,
      });
      sync({ fen: game.fen(), pgn: game.pgn() });
    }
  }

  async function reply() {
    if (pass || game.isGameOver()) return;
    setThinking(true);
    setLine("Thinking…");
    try {
      const move = await getBotMove(game.fen(), eloToConfig(opp.elo), Math.random());
      if (move) {
        game.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
        setFen(game.fen());
        setSans(game.history());
      }
    } finally {
      setThinking(false);
      setLine(opp.line);
    }
    if (game.isCheckmate()) void finish("checkmate", game.turn() === "w" ? "b" : "w");
    else if (game.isDraw()) void finish("draw", null);
  }

  function onMove(move: MoveInput): boolean {
    if (fixture || over || thinking) return false;
    const played = game.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? "q",
    });
    if (!played) return false;
    setFen(game.fen());
    setSans(game.history());
    if (active)
      sync({ fen: game.fen(), pgn: game.pgn(), from: move.from, to: move.to });
    if (game.isCheckmate()) {
      void finish("checkmate", game.turn() === "w" ? "b" : "w");
      return true;
    }
    if (game.isDraw()) {
      void finish("draw", null);
      return true;
    }
    if (!pass && game.turn() === "b") void reply();
    return true;
  }

  function resign() {
    if (fixture) return;
    void finish("resign", "b");
  }

  const dark = scene === "dark";
  const result = over !== null;
  const heading = result
    ? over === "win"
      ? `You beat ${opp.name}!`
      : `${opp.name} won this one`
    : null;

  const art = headArt(scene, opp.id);
  const mood = headMood(scene);
  const frameKey = opp.id === "rex" || opp.id === "skye" ? opp.id : null;
  const frame = frameKey
    ? RESULT_FRAME[frameKey]
    : {
        g1: opp.glow1,
        g2: opp.glow2,
        acc: `var(--acc-${opp.id}-neutral,var(--acc-calm))`,
      };
  const earned = fixture
    ? over === "win"
      ? 50
      : 20
    : over === "win"
      ? BOT_MATCH_WIN_XP
      : 0;

  return (
    <div className="match" data-theme={dark ? "dark" : undefined}>
      <div style={{ display: "contents" }}>
        <div className="m-head">
          <CoachHead art={art} size="3rem" name={opp.name} coach={opp.id} mood={mood} />
          <span className="rt">
            <b>{opp.name}</b>
            <span>{opp.level} · plays Black</span>
          </span>
          <button
            type="button"
            className="btn line sm"
            aria-label="Resign this game"
            onClick={resign}
          >
            <KitIcon name="flag" className="sm" />
            Resign
          </button>
        </div>
        {!result && (
          <div className="m-coach">
            <div className="coachrow">
              <CoachHead
                art={art}
                size="3.5rem"
                name={opp.name}
                coach={opp.id}
                mood={mood}
              />
              <div className="bub" aria-live="polite">
                <div className="say">
                  <span>{line}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Play ${opp.name}'s line again`}
                  >
                    <KitIcon name="volume-2" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="m-board">
        {result ? (
          <div className="card result">
            <div
              className="gframe figf"
              data-mo={opp.id}
              style={{
                ["--g1" as string]: frame.g1,
                ["--g2" as string]: frame.g2,
                ["--acc" as string]: frame.acc,
                width: "7rem",
              }}
            >
              <div
                className="art fig clf"
                role="img"
                aria-label={opp.name}
                data-coach={opp.id}
                data-mood="body-idle"
              />
            </div>
            <div
              className="lot"
              data-lot={over === "win" ? "xp-pop-50" : "xp-pop-20"}
              style={{ ["--w" as string]: "10rem", ["--ar" as string]: "320/168" }}
              aria-hidden="true"
            />
            <h2>{heading}</h2>
            <div className="coachrow">
              <CoachHead
                art={art}
                size="3.5rem"
                name={opp.name}
                coach={opp.id}
                mood={mood}
              />
              <div className="bub" aria-live="polite">
                <div className="say">
                  <span>{line}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Play ${opp.name}'s line again`}
                  >
                    <KitIcon name="volume-2" />
                  </button>
                </div>
              </div>
            </div>
            <p className="muted">
              {over === "win" ? (
                <>
                  Great game. You earned <b>{earned} XP</b>.
                </>
              ) : fixture ? (
                <>
                  You earned <b>{earned} XP</b> for playing.
                </>
              ) : (
                <>No XP this game.</>
              )}
            </p>
            <div style={{ display: "grid", gap: "0.5rem", width: "100%" }}>
              <button type="button" className="btn coral" onClick={() => clear()}>
                Rematch
              </button>
              <Link className="btn line" href="/play" onClick={() => clear()}>
                Back to Play
              </Link>
            </div>
          </div>
        ) : (
          <>
            {fixture ? (
              <div className="boardwrap">
                <div
                  className="board"
                  dangerouslySetInnerHTML={{ __html: PLAY_MATCH_BOARD }}
                />
              </div>
            ) : (
              <div className="boardwrap">
                <div className="board">
                  <ChessBoard
                    fen={fen}
                    interactive
                    onMove={onMove}
                    boardId="play-match"
                    showNotation
                  />
                </div>
              </div>
            )}
            <div className="cap">
              <span>Your turn · you play White</span>
              <span>Move {moveNumberLabel(sans)}</span>
            </div>
          </>
        )}
      </div>
      <div className="m-moves">
        <details className="card" open>
          <summary>
            Moves <KitIcon name="chevron-right" className="sm" />
          </summary>
          <MoveList sans={sans} current />
        </details>
      </div>
    </div>
  );
}
