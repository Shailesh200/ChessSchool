"use client";

import { formatEval, opponentName, parseSetup, reviewPlies, showTry, startTry, summarise, tryReduce, type BoardArrow, type KeyMoment, type TryState } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar, EvalGraph, momentTone } from "@/components/GameParts";
import { Cody } from "@/components/Lottie";
import { Button, TopBar } from "@/components/ui";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";

export default function ReviewGame() {
  const { id } = useParams<{ id: string }>();
  const { state, ready, cue } = useApp();
  const game = state.gameLog.find((g) => g.id === decodeURIComponent(id));
  const setup = useMemo(() => (game ? parseSetup(game.setup) : null), [game]);
  const plies = useMemo(() => (game && setup ? reviewPlies(setup.startFen, game.history) : []), [game, setup]);
  const { notes, done } = useGameAnalysis(plies);
  const [ply, setPly] = useState(0);
  const [trying, setTrying] = useState<TryState | null>(null);
  const [shake, setShake] = useState(0);

  const go = (n: number) => {
    setTrying(null);
    setPly(Math.max(0, Math.min(plies.length, n)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest(".board, input, textarea")) return;
      if (e.key === "ArrowLeft") go(ply - 1);
      if (e.key === "ArrowRight") go(ply + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  if (!game || !setup) {
    return (
      <div className="page page-narrow">
        <TopBar backHref="/gym/review" />
        <p className="lead">{copy.gym.reviewEmpty}</p>
      </div>
    );
  }

  const friend = setup.opponent.kind === "friend";
  const side = friend ? null : setup.you;
  const orientation = friend ? "w" : setup.you;
  const sum = summarise(plies, notes, side);
  const cur = ply ? plies[ply - 1] : null;
  const note = cur ? notes[cur.ply] : null;
  const mine = cur ? !side || cur.by === side : false;
  const moment: KeyMoment | undefined = cur ? sum.moments.find((m) => m.ply === cur.ply) : undefined;
  const kind = moment?.kind ?? note?.verdict ?? "good";
  const tone = mine ? momentTone(kind) : "neutral";
  const moveName = (n: number) => `${Math.ceil(n / 2)}${plies[n - 1]?.by === "w" ? "." : "…"} ${plies[n - 1]?.san ?? ""}`;
  const canTry = Boolean(mine && note?.betterMove && note.better);
  const nextMoment = sum.moments.find((m) => m.ply > ply);
  const evalNow = trying ? (ply > 1 ? (notes[ply - 1]?.evalAfter ?? 0) : 0) : (note?.evalAfter ?? 0);

  const arrows: BoardArrow[] =
    cur && note?.betterMove && mine && (!trying || trying.status !== "trying")
      ? [
          ...(trying ? [] : [{ from: cur.lastMove.from, to: cur.lastMove.to, tone: "played" as const }]),
          { from: note.betterMove.from, to: note.betterMove.to, tone: "better" as const },
        ]
      : [];

  let explain: string;
  if (!cur) explain = copy.analysis.start;
  else if (trying)
    explain =
      trying.status === "right"
        ? copy.analysis.tryRight
        : trying.status === "shown"
          ? copy.analysis.tryShown(note?.better ?? "")
          : trying.status === "wrong"
            ? copy.analysis.tryWrong
            : copy.analysis.tryPrompt(copy.play.sides[cur.by]);
  else if (!mine) explain = copy.analysis.explain.opponent;
  else if (kind === "great" || kind === "mate" || kind === "good") explain = copy.analysis.explain[kind];
  else explain = copy.analysis.explain[kind](note?.better ?? null);

  const tap = (sq: Parameters<typeof tryReduce>[1]) => {
    if (!trying) return;
    const next = tryReduce(trying, sq);
    if (next.status === "right" && trying.status !== "right") cue("success");
    if (next.status === "wrong" && next.misses > trying.misses) {
      cue("gentle-no");
      setShake((n) => n + 1);
    }
    setTrying(next);
  };

  return (
    <div className="page play-page analysis-page">
      <TopBar backHref="/gym/review" title={copy.analysis.title} />
      <div className="play">
        <BoardStage
          className="play-stage"
          top={
            <div className="player">
              <Cody animation={tone === "danger" ? "thinking" : tone === "success" ? "happy" : "reading"} size={44} />
              <p className="stage-status">{friend ? copy.gym.vsFriend : copy.play.vs(opponentName(setup))}</p>
              <span className="clock" aria-label={copy.analysis.evalLabel(formatEval(evalNow))}>
                {formatEval(evalNow)}
              </span>
            </div>
          }
          bottom={null}
        >
          <div className="analysis-board">
            <EvalBar cp={evalNow} orientation={orientation} />
            <Board
              fen={trying ? trying.fen : cur ? cur.fen : setup.startFen}
              orientation={orientation}
              lastMove={trying ? trying.lastMove : cur?.lastMove}
              selected={trying?.selected ?? null}
              targets={trying?.targets ?? []}
              check={trying ? null : ((cur?.check as never) ?? null)}
              arrows={arrows}
              onTap={tap}
              disabled={!trying || trying.status === "right" || trying.status === "shown"}
              shake={shake}
              label={arrows.length === 2 && cur && note?.better ? copy.analysis.arrowsLabel(cur.san, note.better) : undefined}
            />
          </div>
        </BoardStage>
        <div className="play-panel">
          <div className="eval-card">
            <div className="eval-card-head">
              <span>{copy.analysis.advantage}</span>
              <span>{done ? copy.analysis.moveOf(Math.ceil(ply / 2), Math.ceil(plies.length / 2)) : copy.analysis.looking}</span>
            </div>
            <EvalGraph plies={plies} notes={notes} current={ply} marks={sum.moments} onPick={go} />
          </div>

          {sum.moments.length ? (
            <ul className="moments" aria-label={copy.gym.keyMoments(sum.moments.length)}>
              {sum.moments.map((m) => (
                <li key={`${m.ply}${m.kind}`}>
                  <button type="button" className={`moment m-${momentTone(m.kind)}`} aria-pressed={m.ply === ply} onClick={() => go(m.ply)}>
                    {Math.ceil(m.ply / 2)} · {copy.analysis.kinds[m.kind]}
                  </button>
                </li>
              ))}
            </ul>
          ) : done ? (
            <p className="muted">{copy.analysis.noMoments}</p>
          ) : null}

          <div className={`explain m-${tone}`} role="status" aria-live="polite">
            <div className="explain-head">
              <span>{cur ? `${moveName(cur.ply)} · ${mine ? copy.analysis.kinds[kind] : copy.analysis.opponentMove}` : copy.gym.first}</span>
              {note ? <span className="muted">{formatEval(note.evalAfter)}</span> : null}
            </div>
            <p>{explain}</p>
          </div>

          <div className="analysis-nav">
            <Button variant="secondary" icon="back" onClick={() => go(ply - 1)} disabled={!ply} aria-label={copy.gym.prev}>
              {""}
            </Button>
            {trying ? (
              trying.status === "right" || trying.status === "shown" ? (
                <Button icon="back" onClick={() => setTrying(null)}>
                  {copy.analysis.backToGame}
                </Button>
              ) : (
                <Button variant="secondary" icon="eye" onClick={() => setTrying(showTry(trying))}>
                  {copy.analysis.showMe}
                </Button>
              )
            ) : canTry && cur && note?.betterMove ? (
              <Button icon="bulb" onClick={() => setTrying(startTry(cur.fenBefore, note.betterMove!))}>
                {copy.analysis.tryBetter}
              </Button>
            ) : (
              <Button variant="secondary" icon="spark" onClick={() => nextMoment && go(nextMoment.ply)} disabled={!nextMoment}>
                {copy.analysis.nextMoment}
              </Button>
            )}
            <Button variant="secondary" icon="chevron" onClick={() => go(ply + 1)} disabled={ply >= plies.length} aria-label={copy.gym.next}>
              {""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
