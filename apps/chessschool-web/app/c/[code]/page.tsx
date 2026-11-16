"use client";

import { defaultSetup, playReduce, startGame, type PlayAction, type PlayState, type Puzzle } from "@chessschool/chess";
import { copy, type Challenge } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { MemberFace } from "@/components/ClassPlay";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, useToast } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { api } from "@/lib/api";
import { seat, shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";

const POLL_MS = 5000;

/**
 * A challenge link: a puzzle to try, or a slow game against the friend who sent it.
 * Works with no account. There is no chat; a child's challenge shows an avatar and no name.
 */
export default function ChallengePage() {
  const { code } = useParams<{ code: string }>();
  const { cue } = useApp();
  const toast = useToast();
  const t = copy.challenge;
  const [ch, setCh] = useState<Challenge | null>(null);
  const [missing, setMissing] = useState(false);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [started, setStarted] = useState(false);
  const [mine, setMine] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const show = useCallback((c: Challenge) => {
    setCh(c);
    if (c.kind === "game") setPlay(startGame({ ...defaultSetup(), opponent: { kind: "friend" }, you: c.you ?? "b", takebacks: false, askPromotion: false }, Date.now(), c.moves));
  }, []);
  const load = useCallback(() => {
    api
      .friendChallenge(code, seat.get(code))
      .then((r) => show(r.challenge))
      .catch((err: { status?: number }) => err?.status === 404 && setMissing(true));
  }, [code, show]);
  useEffect(load, [load]);

  const polling = Boolean(ch && ch.kind === "game" && !ch.expired && ch.status !== "over" && !ch.yourTurn);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, load]);

  if (missing || !ch) {
    return (
      <main className="landing">
        <Wordmark size="lg" />
        {missing ? <h1>{t.expired}</h1> : <div className="page-skeleton" aria-busy="true" />}
        {missing ? (
          <Button block href="/">
            {t.learn}
          </Button>
        ) : null}
      </main>
    );
  }

  const name = ch.creator.name ?? "";
  const creator = ch.you === "w";
  const act = (a: PlayAction) => {
    if (!play || !ch.yourTurn || busy) return;
    const next = playReduce(play, a);
    if (next === play) return;
    setPlay(next);
    if (next.history.length === play.history.length || !next.lastMove) return;
    setBusy(true);
    api
      .challengeMove(code, { from: next.lastMove.from, to: next.lastMove.to, promotion: /=([QRBN])/.exec(next.history.at(-1) ?? "")?.[1]?.toLowerCase(), seat: seat.get(code) })
      .then((r) => (cue(r.challenge.status === "over" ? "success" : "tap"), show(r.challenge)))
      .catch(() => (cue("gentle-no"), load()))
      .finally(() => setBusy(false));
  };
  const accept = () => {
    setBusy(true);
    api
      .acceptChallenge(code)
      .then((r) => (seat.set(code, r.seat), show(r.challenge)))
      .catch(() => (toast(t.taken), load()))
      .finally(() => setBusy(false));
  };
  const friendLine = ch.friendResult === "solved" ? t.friendSolved : ch.friendResult === "missed" ? t.friendMissed : t.friendPending;
  const gameLine = ch.status === "over" ? (ch.result === "1/2-1/2" ? copy.play.results.draw.title : copy.gym.friendWin(copy.play.sides[ch.result === "1-0" ? "w" : "b"])) : ch.status === "waiting" ? (creator ? t.yours : t.bodyGame) : ch.yourTurn ? copy.lesson.yourMove : t.waiting;

  return (
    <main className="landing challenge" data-kind={ch.kind} data-status={ch.status}>
      <Wordmark size="lg" />
      <div className="challenge-who">
        <MemberFace id={ch.creator.avatar} size={48} />
        <h1>{creator ? t.yours : ch.kind === "puzzle" ? t.titlePuzzle(name) : t.titleGame(name)}</h1>
      </div>
      {ch.expired ? <p role="alert">{t.expired}</p> : null}

      {ch.kind === "puzzle" && ch.puzzle && !ch.expired ? (
        creator ? (
          <p className="lead" role="status">
            {friendLine}
          </p>
        ) : started ? (
          <div className="challenge-board">
            <PuzzlePlayer
              puzzle={ch.puzzle as Puzzle}
              onResult={(solved) => {
                setMine(solved);
                api.challengeResult(code, solved).then((r) => show(r.challenge)).catch(() => {});
              }}
              actions={mine === null ? null : <p role="status">{mine ? t.solved : t.missed}</p>}
            />
          </div>
        ) : (
          <>
            <p className="lead">{t.bodyPuzzle}</p>
            <Button block onClick={() => setStarted(true)}>
              {t.start}
            </Button>
          </>
        )
      ) : null}

      {ch.kind === "game" && play ? (
        <>
          <p className="lead" role="status" aria-live="polite">
            {gameLine}
          </p>
          {ch.status === "waiting" && !creator && !ch.expired ? (
            <Button block loading={busy} onClick={accept}>
              {t.start}
            </Button>
          ) : (
            <div className="challenge-board">
              <Board
                fen={play.fen}
                orientation={ch.you ?? "w"}
                selected={play.selected}
                targets={play.targets}
                lastMove={play.lastMove}
                check={play.check}
                onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })}
                disabled={!ch.yourTurn || busy}
              />
            </div>
          )}
        </>
      ) : null}

      {creator && !ch.expired ? (
        <Button block variant="secondary" onClick={() => void shareLink(t.shareText, ch.url).then((r) => r === "copied" && toast(t.copied))}>
          {t.copy}
        </Button>
      ) : null}
      <Button block variant="ghost" href="/">
        {t.learn}
      </Button>
    </main>
  );
}
