"use client";

import { formatEval, moveFacts, moveNoAt, opponentName, parseSetup, playerHues, plyName, reviewPlies, showTry, startTry, summarise, tryReduce, type BoardArrow, type Color, type KeyMoment, type TryState } from "@chessschool/chess";
import { copy, moveStory } from "@chessschool/design";
import { useConnectivity } from "@/lib/hooks";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar, EvalGraph, momentTone } from "@/components/GameParts";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, TopBar } from "@/components/ui";
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
  const [ply, setPly] = useState(0);
  const [trying, setTrying] = useState<TryState | null>(null);
  const [shake, setShake] = useState(0);
  // "Try it" grows the board (CSS transition on .expanded); browser back, the header back and the close button shrink it again.
  const expanded = trying !== null;
  const pushed = useRef(false);
  useEffect(() => {
    if (!expanded) {
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
      }
      return;
    }
    window.history.pushState(null, "", window.location.href);
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      setTrying(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [expanded]);
  const friend = setup?.opponent.kind === "friend";
  const side = !setup || friend ? null : setup.you;
  const coach = useCoachNotes(game?.history, setup?.startFen ?? "", side);
  useReviewedSkills(game, plies, notes, done, side);
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
      if (e.key === "Escape" && trying) setTrying(null);
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
  const other = setup.opponent.kind === "bot" ? opponentName(setup) : copy.myGames.friend;
  const playerName = (by: Color) => (friend ? copy.play.sides[by] : by === setup.you ? copy.myGames.you : other);
  // Each player's colour, kept on the game so it is the same every time the game is opened.
  const hues = playerHues(setup.whiteHue, game.id);
  const sum = summarise(plies, notes, side);
  const cur = ply ? plies[ply - 1] : null;
  const note = cur ? notes[cur.ply] : null;
  const mine = cur ? !side || cur.by === side : false;
  const moment: KeyMoment | undefined = cur ? sum.moments.find((m) => m.ply === cur.ply) : undefined;
  const kind = moment?.kind ?? note?.verdict ?? "good";
  const tone = mine ? momentTone(kind) : "neutral";
  // The engine's board facts for this move: they word the explanation, and their better move is the one to try.
  const facts = cur && note ? moveFacts(cur, note) : null;
  const better = facts?.better ?? note?.better ?? null;
  const betterMove = facts?.betterMove ?? note?.betterMove ?? null;
  const canTry = Boolean(mine && betterMove && better && note?.verdict !== "good");
  const nextMoment = sum.moments.find((m) => m.ply > ply);
  const evalNow = trying ? (ply > 1 ? (notes[ply - 1]?.evalAfter ?? 0) : 0) : (note?.evalAfter ?? 0);

  const arrows: BoardArrow[] =
    cur && betterMove && canTry && (!trying || trying.status !== "trying")
      ? [
          ...(trying ? [] : [{ from: cur.lastMove.from, to: cur.lastMove.to, tone: "played" as const }]),
          { from: betterMove.from, to: betterMove.to, tone: "better" as const },
        ]
      : [];

  let explain: string;
  if (!cur) explain = copy.analysis.start;
  else if (trying)
    explain =
      trying.status === "right"
        ? copy.analysis.tryRight
        : trying.status === "shown"
          ? copy.analysis.tryShown(better ?? "")
          : trying.status === "wrong"
            ? copy.analysis.tryWrong
            : copy.analysis.tryPrompt(copy.play.sides[cur.by]);
  else if (mine && (kind === "great" || kind === "mate")) explain = copy.analysis.explain[kind];
  else if (facts) explain = moveStory(facts, mine);
  else explain = mine ? copy.analysis.looking : copy.analysis.explain.opponent;

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
  const canAsk = coach.signedIn && coach.allowed && connectivity === "online" && (coach.status === "idle" || coach.status === "error");

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
    <div className={`page play-page analysis-page${expanded ? " expanded" : ""}`}>
      <TopBar backHref="/gym/review" onBack={expanded ? () => setTrying(null) : undefined} title={copy.analysis.title} />
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
              {expanded ? (
                <button type="button" className="icon-btn" aria-label={copy.analysis.minimise} onClick={() => setTrying(null)}>
                  <Icon name="close" />
                </button>
              ) : null}
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
              label={arrows.length === 2 && cur && better ? copy.analysis.arrowsLabel(cur.san, better) : undefined}
            />
          </div>
        </BoardStage>
        <div className="play-panel">
          <div className="fold" aria-hidden={expanded || undefined} inert={expanded || undefined}>
          <div>
          <div className="eval-card">
            <div className="eval-card-head">
              <span>{copy.analysis.advantage}</span>
              <span>{done ? copy.analysis.moveOf(moveNoAt(plies, ply), plies.at(-1)?.moveNo ?? 0) : copy.analysis.looking}</span>
            </div>
            <EvalGraph plies={plies} notes={notes} current={ply} marks={sum.moments} onPick={go} />
          </div>

          {sum.moments.length ? (
            <ul className="moments" aria-label={copy.gym.keyMoments(sum.moments.length)}>
              {sum.moments.map((m) => (
                <li key={`${m.ply}${m.kind}`}>
                  <button type="button" className={`moment m-${momentTone(m.kind)}`} aria-pressed={m.ply === ply} onClick={() => go(m.ply)}>
                    {moveNoAt(plies, m.ply)} · {copy.analysis.kinds[m.kind]}
                  </button>
                </li>
              ))}
            </ul>
          ) : done ? (
            <p className="muted">{copy.analysis.noMoments}</p>
          ) : null}

          {plies.length ? (
            <>
              <ul className="player-chips" aria-label={copy.analysis.players}>
                {(orientation === "w" ? (["w", "b"] as const) : (["b", "w"] as const)).map((by) => (
                  <li key={by} className={`player-chip hue-${hues[by]}`}>
                    <span className="hue-dot" aria-hidden />
                    {`${playerName(by)} · ${copy.play.sides[by]}`}
                  </li>
                ))}
              </ul>
              <ol className="move-list" aria-label={copy.myGames.moves}>
                {plies.map((p) => {
                  const m = sum.moments.find((x) => x.ply === p.ply);
                  return (
                    <li key={p.ply}>
                      <button type="button" className={`move-chip hue hue-${hues[p.by]}${m ? ` m-${momentTone(m.kind)}` : ""}`} aria-pressed={p.ply === ply && !trying} aria-label={`${copy.myGames.goTo(plyName(p))}, ${playerName(p.by)}`} onClick={() => go(p.ply)}>
                        {plyName(p)}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
          </div>
          </div>

          <div className={`explain m-${tone}`} role="status" aria-live="polite">
            <div className="explain-head">
              <span>
                {cur ? <span className={`hue-dot hue-${hues[cur.by]}`} aria-hidden /> : null}
                {cur ? `${plyName(cur)} · ${mine ? copy.analysis.kinds[kind] : copy.analysis.opponentMove}` : copy.gym.first}
              </span>
              {note ? <span className="muted">{formatEval(note.evalAfter)}</span> : null}
            </div>
            <p>{explain}</p>
          </div>

          <div className="fold" aria-hidden={expanded || undefined} inert={expanded || undefined}>
          <section className="coach-notes" aria-label={copy.coachAi.title}>
            {coachLine ? (
              <p className="muted" role="status">
                {coachLine}
              </p>
            ) : null}
            {canAsk ? (
              <Button variant="secondary" icon="sparkles" onClick={coach.ask} disabled={!done}>
                {coach.status === "error" ? copy.coachAi.retry : copy.coachAi.button}
              </Button>
            ) : null}
            {coach.notes.length ? (
              <>
                <h2>{copy.coachAi.title}</h2>
                <ul>
                  {coach.notes.map((n) => (
                    <li key={n.ply}>
                      <button type="button" className={`coach-note${n.ply === ply ? " on" : ""}`} aria-pressed={n.ply === ply} onClick={() => go(n.ply)}>
                        <strong>{copy.coachAi.moveLabel(plies[n.ply - 1]?.moveNo ?? moveNoAt(plies, n.ply), n.san)}</strong>
                        <span>{n.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="muted small">{copy.coachAi.note}</p>
              </>
            ) : null}
          </section>
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
            ) : canTry && cur && betterMove ? (
              <Button icon="bulb" onClick={() => setTrying(startTry(cur.fenBefore, betterMove))}>
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
          <Button variant="ghost" icon="bulb" href={`/gym/analysis?start=${encodeURIComponent(setup.startFen)}&moves=${encodeURIComponent(plies.map((p) => p.san).join(" "))}&at=${ply}&side=${orientation}`}>
            {copy.myGames.analyse}
          </Button>
        </div>
      </div>
    </div>
  );
}
