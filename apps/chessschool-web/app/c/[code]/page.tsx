"use client";

import { defaultSetup, playReduce, startGame, type PlayAction, type PlayState, type Puzzle } from "@chessschool/chess";
import { challengeRecord, clockSince, copy, importGame, queueGameSave, formatClock, isLive, type Challenge, type TimeControl } from "@chessschool/design";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { MemberFace } from "@/components/MemberFace";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, useToast } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { api } from "@/lib/api";
import { seat, shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";

const POLL_MS = 5000;
/** Live games check more often: there is time on the clock to lose. */
const POLL_LIVE_MS = 2000;

/**
 * A challenge link: a puzzle to try, or a slow game against the friend who sent it.
 * Works with no account. There is no chat; a child's challenge shows an avatar and no name.
 */
export default function ChallengePage() {
  const { code } = useParams<{ code: string }>();
  const { cue, state, update } = useApp();
  const toast = useToast();
  const t = copy.challenge;
  const [ch, setCh] = useState<Challenge | null>(null);
  const [missing, setMissing] = useState(false);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [started, setStarted] = useState(false);
  const [mine, setMine] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [confirmResign, setConfirmResign] = useState(false);

  const show = useCallback((c: Challenge) => {
    setCh(c);
    setReceivedAt(Date.now());
    if (c.kind === "game") setPlay(startGame({ ...defaultSetup(), opponent: { kind: "friend" }, you: c.you ?? "b", takebacks: false, askPromotion: false }, Date.now(), c.moves));
  }, []);
  const load = useCallback(() => {
    api
      .friendChallenge(code, seat.get(code))
      .then((r) => show(r.challenge))
      .catch((err: { status?: number }) => err?.status === 404 && setMissing(true));
  }, [code, show]);
  useEffect(load, [load]);

  // Running games poll on both turns: a resign, a draw offer or a timeout can come at any time.
  // A finished game joins "My games" (and the account's copy) once; the friend's name is not kept.
  const over = ch && ch.kind === "game" && ch.status === "over" ? ch : null;
  useEffect(() => {
    if (!over) return;
    const rec = challengeRecord(over, Date.now());
    if (rec) update((s) => (s.gameLog.some((g) => g.id === rec.id) ? s : s.account ? queueGameSave(importGame(s, rec), rec) : importGame(s, rec)));
    // Once per finished challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over?.code]);
  const polling = Boolean(ch && ch.kind === "game" && !ch.expired && ch.status !== "over");
  const pollMs = ch?.tc && isLive(ch.tc) ? POLL_LIVE_MS : POLL_MS;
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(load, pollMs);
    return () => clearInterval(timer);
  }, [polling, pollMs, load]);
  const ticking = Boolean(ch?.clock?.running) || ch?.status === "waiting";
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);

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
  const endGame = (fn: typeof api.challengeResign) => {
    setBusy(true);
    fn(code, seat.get(code))
      .then((r) => show(r.challenge))
      .catch(() => load())
      .finally(() => setBusy(false));
  };
  const friendLine = ch.friendResult === "solved" ? t.friendSolved : ch.friendResult === "missed" ? t.friendMissed : t.friendPending;
  const loser = ch.result === "1-0" ? "b" : "w";
  const sideName = (side: "w" | "b") => (side === ch.you ? t.you : creator ? t.friend : name || t.friend);
  const ended =
    ch.endReason === "aborted"
      ? t.ended.aborted
      : ch.endReason === "agreed"
        ? t.ended.agreed
        : ch.endReason === "time"
          ? t.ended.time(sideName(loser))
          : ch.endReason === "resign"
            ? t.ended.resign(sideName(loser))
            : ch.result === "1/2-1/2"
              ? copy.play.results.draw.title
              : copy.gym.friendWin(copy.play.sides[ch.result === "1-0" ? "w" : "b"]);
  const gameLine = ch.status === "over" ? ended : ch.status === "waiting" ? (creator ? t.yours : t.bodyGame) : ch.drawOffer && ch.drawOffer !== ch.you ? t.friendOffersDraw : ch.yourTurn ? copy.lesson.yourMove : t.waiting;
  const shown = ch.clock && now ? clockSince(ch.clock, now - receivedAt) : { white: ch.clock?.white ?? null, black: ch.clock?.black ?? null };
  const joinLeft = ch.joinBy && now ? Math.max(0, ch.joinBy - now) : null;
  const tc = (ch.tc ?? "none") as TimeControl;
  const playerRow = (side: "w" | "b") => {
    const ms = side === "w" ? shown.white : shown.black;
    const running = ch.clock?.running === side;
    return (
      <div className={`pvp-player${side === ch.you ? " is-me" : ""}`}>
        <MemberFace id={side === "w" ? ch.creator.avatar : "cody"} size={36} />
        <strong>{sideName(side)}</strong>
        {ms !== null ? (
          <span role="timer" aria-label={t.clockOf(sideName(side), formatClock(ms, tc))} className={`pvp-clock${running ? " is-running" : ""}${running && ms < 20_000 ? " is-low" : ""}`}>
            {formatClock(ms, tc)}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <main className="landing challenge" data-kind={ch.kind} data-status={ch.status}>
      <Wordmark size="lg" />
      <div className="challenge-who">
        <MemberFace id={ch.creator.avatar} size={48} />
        <h1>{creator ? t.yours : ch.kind === "puzzle" ? t.titlePuzzle(name) : t.titleGame(name)}</h1>
        {!creator && state.account ? (
          <Link className="challenge-report" href={`/report?challenge=${encodeURIComponent(code)}&name=${encodeURIComponent(ch.creator.name ?? copy.you.noName)}`}>
            {copy.social.report}
          </Link>
        ) : null}
      </div>
      {ch.expired ? <p role="alert">{ch.status === "waiting" && creator ? t.joinGone : t.expired}</p> : null}

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
          ) : ch.status === "waiting" && creator && !ch.expired ? (
            <div className="pvp-wait">
              <div className="pvp-ring" role="timer" aria-label={`${formatClock(joinLeft ?? 0, "10m")} ${t.joinLeft}`}>
                <strong>{joinLeft === null ? "–" : formatClock(joinLeft, "10m")}</strong>
                <span>{t.joinLeft}</span>
              </div>
              <h2>{t.waitingFriend}</h2>
              <p className="muted">{t.joinBody(t.tc[tc])}</p>
            </div>
          ) : (
            <div className="challenge-board">
              {playerRow(ch.you === "w" ? "b" : "w")}
              <Board
                fen={play.fen}
                orientation={ch.you ?? "w"}
                selected={play.selected}
                targets={play.targets}
                lastMove={play.lastMove}
                check={play.check}
                onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })}
                disabled={!ch.yourTurn || busy || ch.status !== "active"}
              />
              {playerRow(ch.you ?? "w")}
              {ch.status === "active" && ch.you ? (
                <div className="pvp-actions">
                  <Button variant={ch.drawOffer && ch.drawOffer !== ch.you ? "primary" : "secondary"} disabled={busy || ch.drawOffer === ch.you} onClick={() => endGame(api.challengeDraw)}>
                    {ch.drawOffer && ch.drawOffer !== ch.you ? t.acceptDraw : ch.drawOffer === ch.you ? t.drawSent : t.offerDraw}
                  </Button>
                  <Button variant={confirmResign ? "danger" : "secondary"} disabled={busy} onClick={() => (confirmResign ? (setConfirmResign(false), endGame(api.challengeResign)) : setConfirmResign(true))}>
                    {confirmResign ? t.resignSure : t.resign}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {creator && !ch.expired && ch.status === "waiting" ? (
        <Button block variant="secondary" onClick={() => void shareLink(t.shareText, ch.url).then((r) => r === "copied" && toast(t.copied))}>
          {t.sendAgain}
        </Button>
      ) : null}
      <Button block variant="ghost" href="/">
        {t.learn}
      </Button>
    </main>
  );
}
