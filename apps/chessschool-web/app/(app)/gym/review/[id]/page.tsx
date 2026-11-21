"use client";

import { formatEval, keyMomentCard, opponentName, parseSetup, reviewPlies, showTry, startTry, summarise, tryReduce, type BoardArrow, type KeyMoment, type TryState } from "@chessschool/chess";
import { copy, gameKind, gamePgn, pgnFileName } from "@chessschool/design";
import { botInfo, isBotId } from "@chessschool/chess";
import { copyText, downloadText } from "@/lib/share";
import { useConnectivity } from "@/lib/hooks";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar, EvalGraph, momentTone } from "@/components/GameParts";
import { KeyMomentCard } from "@/components/KeyMoment";
import { Cody } from "@/components/Lottie";
import { Button, Sheet, TopBar, useToast } from "@/components/ui";
import { useCoachNotes, useReviewedSkills } from "@/lib/coach";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";

export default function ReviewGame() {
  const { id } = useParams<{ id: string }>();
  const { state, ready, cue } = useApp();
  const game = state.gameLog.find((g) => g.id === decodeURIComponent(id));
  // Keyed on the setup and moves, not the record: marking a game reviewed must not restart the analysis.
  const gameSetup = game?.setup;
  const history = game?.history;
  const setup = useMemo(() => (gameSetup ? parseSetup(gameSetup) : null), [gameSetup]);
  const plies = useMemo(() => (history && setup ? reviewPlies(setup.startFen, history) : []), [history, setup]);
  const { notes, done } = useGameAnalysis(plies);
  const connectivity = useConnectivity().status;
  const toast = useToast();
  const [ply, setPly] = useState(0);
  const [trying, setTrying] = useState<TryState | null>(null);
  const [shake, setShake] = useState(0);
  const [keyOpen, setKeyOpen] = useState(true);
  const friend = setup?.opponent.kind === "friend";
  const side = !setup || friend ? null : setup.you;
  const coach = useCoachNotes(game?.history, setup?.startFen ?? "", side);
  useReviewedSkills(game, plies, notes, done, side);
  // Imported games land here, so their card opens here; bot and friend games showed it on the result sheet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hasKey = useMemo(() => game?.reason === "imported" && done && keyMomentCard(plies, notes, side) !== null, [game?.reason, done, plies, side]);
  const firstNote = coach.notes[0]?.ply;
  useEffect(() => {
    if (firstNote) {
      setTrying(null);
      setPly(firstNote);
    }
  }, [firstNote]);

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

  const orientation = friend ? "w" : setup.you;
  const other = gameKind(game) === "challenge" ? copy.myGames.friend : setup.opponent.kind === "bot" && isBotId(setup.opponent.bot) ? botInfo(setup.opponent.bot).name : friend ? copy.myGames.friend : copy.gym.vsOnline;
  const pgn = gamePgn(game, friend ? { white: copy.play.sides.w, black: copy.play.sides.b } : setup.you === "w" ? { white: copy.myGames.you, black: other } : { white: other, black: copy.myGames.you }, copy.myGames.pgnEvent);
  const copied = (ok: boolean) => ok && toast(copy.myGames.copied);
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

  const coachLine = connectivity !== "online" && coach.status !== "done"
    ? copy.myGames.offlineNotes
    : !coach.signedIn
    ? copy.coachAi.signIn
    : !coach.allowed
      ? copy.myGames.engineOnly
      : coach.status === "loading"
        ? copy.coachAi.loading
        : coach.status === "error"
          ? copy.coachAi.failed
          : coach.status === "limit"
            ? copy.coachAi.limit
            : coach.status === "done" && !coach.notes.length
              ? copy.coachAi.none
              : null;

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
              <p className="stage-status">{friend ? copy.gym.vsFriend : setup.opponent.kind === "online" ? copy.gym.vsOnline : copy.play.vs(opponentName(setup))}</p>
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

          {plies.length ? (
            <ol className="move-list" aria-label={copy.myGames.moves}>
              {plies.map((p) => {
                const m = sum.moments.find((x) => x.ply === p.ply);
                return (
                  <li key={p.ply}>
                    <button type="button" className={`move-chip${m ? ` m-${momentTone(m.kind)}` : ""}`} aria-pressed={p.ply === ply && !trying} aria-label={copy.myGames.goTo(moveName(p.ply))} onClick={() => go(p.ply)}>
                      {moveName(p.ply)}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className={`explain m-${tone}`} role="status" aria-live="polite">
            <div className="explain-head">
              <span>{cur ? `${moveName(cur.ply)} · ${mine ? copy.analysis.kinds[kind] : copy.analysis.opponentMove}` : copy.gym.first}</span>
              {note ? <span className="muted">{formatEval(note.evalAfter)}</span> : null}
            </div>
            <p>{explain}</p>
          </div>

          <section className="coach-notes" aria-label={copy.coachAi.title}>
            {coachLine ? (
              <p className="muted" role="status">
                {coachLine}
              </p>
            ) : coach.status === "idle" ? (
              <Button variant="secondary" icon="spark" onClick={coach.ask} disabled={!done}>
                {copy.coachAi.button}
              </Button>
            ) : null}
            {coach.notes.length ? (
              <>
                <h2>{copy.coachAi.title}</h2>
                <ul>
                  {coach.notes.map((n) => (
                    <li key={n.ply}>
                      <button type="button" className={`coach-note${n.ply === ply ? " on" : ""}`} aria-pressed={n.ply === ply} onClick={() => go(n.ply)}>
                        <strong>{copy.coachAi.moveLabel(Math.ceil(n.ply / 2), n.san)}</strong>
                        <span>{n.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="muted small">{copy.coachAi.note}</p>
              </>
            ) : null}
          </section>
          <Sheet open={keyOpen && hasKey} onClose={() => setKeyOpen(false)} labelledBy="key-moment-title">
            <KeyMomentCard
              plies={plies}
              notes={notes}
              done={done}
              side={side}
              orientation={orientation}
              coachNoteFor={(p) => coach.noteFor(p)?.text ?? null}
              onShow={(p) => {
                setKeyOpen(false);
                go(p);
              }}
            />
            <Button block variant="ghost" onClick={() => setKeyOpen(false)}>
              {copy.analysis.close}
            </Button>
          </Sheet>

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
          <div className="game-actions">
            <Button variant="ghost" icon="arrowRight" onClick={() => downloadText(pgnFileName(game, other), pgn)}>
              {copy.myGames.downloadPgn}
            </Button>
            <Button variant="ghost" icon="doc" onClick={() => void copyText(pgn).then(copied)}>
              {copy.myGames.copyPgn}
            </Button>
            <Button variant="ghost" icon="doc" onClick={() => void copyText(trying ? trying.fen : cur ? cur.fen : setup.startFen).then(copied)}>
              {copy.myGames.copyFen}
            </Button>
          </div>
          <Button variant="secondary" icon="bulb" href={`/gym/analysis?start=${encodeURIComponent(setup.startFen)}&moves=${encodeURIComponent(plies.map((p) => p.san).join(" "))}&at=${ply}&side=${orientation}`}>
            {copy.myGames.analyse}
          </Button>
        </div>
      </div>
    </div>
  );
}
