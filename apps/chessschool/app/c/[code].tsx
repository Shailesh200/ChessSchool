import { defaultSetup, playReduce, startGame, type PlayAction, type PlayState, type Puzzle, type Square } from "@chessschool/chess";
import { challengeRecord, clockSince, copy, importGame, queueGameSave, formatClock, isLive, JOIN_MS, type Challenge, type TimeControl } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AvatarFace } from "@/components/AvatarFace";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, T, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { seat, shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const POLL_MS = 5000;
/** Live games check twice as often as there is time on the clock to lose. */
const POLL_LIVE_MS = 2000;

/** Seconds-accurate clocks between polls: the running side's time counts down from what the server last said. */
function useClocks(ch: Challenge | null, receivedAt: number) {
  const [now, setNow] = useState(Date.now());
  const ticking = Boolean(ch?.clock?.running) || ch?.status === "waiting";
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);
  const clock = ch?.clock ?? null;
  const shown = clock ? clockSince(clock, now - receivedAt) : { white: null, black: null };
  return { ...shown, running: clock?.running ?? null, now };
}

/**
 * A challenge link (chess-school.in/c/<code>): a puzzle to try, or a slow game with the friend who sent it.
 * No chat; a child's challenge shows an avatar and no name.
 */
export default function ChallengeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { cue, update } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.challenge;
  const [ch, setCh] = useState<Challenge | null>(null);
  const [missing, setMissing] = useState(false);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [started, setStarted] = useState(false);
  const [mine, setMine] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const mySeat = useRef<string | null>(null);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [confirmResign, setConfirmResign] = useState(false);
  const clocks = useClocks(ch, receivedAt);

  const show = useCallback((next: Challenge) => {
    setCh(next);
    setReceivedAt(Date.now());
    if (next.kind === "game") setPlay(startGame({ ...defaultSetup(), opponent: { kind: "friend" }, you: next.you ?? "b", takebacks: false, askPromotion: false }, Date.now(), next.moves));
  }, []);
  const load = useCallback(async () => {
    mySeat.current ??= await seat.get(code);
    api
      .friendChallenge(code, mySeat.current)
      .then((r) => show(r.challenge))
      .catch((err: { status?: number }) => err?.status === 404 && setMissing(true));
  }, [code, show]);
  useEffect(() => void load(), [load]);

  // Running games poll on both turns too: a resign, a draw offer or a timeout can come at any time.
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
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [polling, pollMs, load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/today"));
  if (missing || !ch) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16, gap: 12 }}>
        <TopBar onBack={back} />
        {missing ? <T role="bodyLg">{t.expired}</T> : null}
      </SafeAreaView>
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
      .challengeMove(code, { from: next.lastMove.from, to: next.lastMove.to, promotion: /=([QRBN])/.exec(next.history.at(-1) ?? "")?.[1]?.toLowerCase(), seat: mySeat.current })
      .then((r) => (cue(r.challenge.status === "over" ? "success" : "tap"), show(r.challenge)))
      .catch(() => (cue("gentle-no"), void load()))
      .finally(() => setBusy(false));
  };
  const accept = () => {
    setBusy(true);
    api
      .acceptChallenge(code)
      .then((r) => {
        mySeat.current = r.seat;
        void seat.set(code, r.seat);
        show(r.challenge);
      })
      .catch(() => (toast(t.taken), void load()))
      .finally(() => setBusy(false));
  };
  const endGame = (fn: typeof api.challengeResign) => {
    setBusy(true);
    fn(code, mySeat.current)
      .then((r) => show(r.challenge))
      .catch(() => void load())
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
  const joinLeft = ch.joinBy ? Math.max(0, ch.joinBy - clocks.now) : 0;
  const tcName = t.tc[(ch.tc ?? "none") as TimeControl];
  const clockPill = (side: "w" | "b") => {
    const ms = side === "w" ? clocks.white : clocks.black;
    if (ms === null || !ch.tc) return null;
    const running = clocks.running === side;
    return (
      <View accessibilityRole="timer" accessibilityLabel={t.clockOf(sideName(side), formatClock(ms, ch.tc))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: running ? (ms < 20_000 ? c.danger : c.accent) : c.sunken }}>
        <T role="heading" style={{ fontFamily: fonts.bold, color: running ? c.onAccent : c.textMuted, fontVariant: ["tabular-nums"] }}>
          {formatClock(ms, ch.tc)}
        </T>
      </View>
    );
  };
  const playerRow = (side: "w" | "b") => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, padding: 10, borderRadius: 18, backgroundColor: side === ch.you ? c.text : c.card, borderWidth: side === ch.you ? 0 : 1, borderColor: c.line }}>
      {/* White is always the creator; the friend has no account avatar. */}
      <AvatarFace id={side === "w" ? ch.creator.avatar : "cody"} size={36} />
      <T role="label" style={{ flex: 1, color: side === ch.you ? c.bg : c.text }}>
        {sideName(side)}
      </T>
      {clockPill(side)}
    </View>
  );
  const puzzleOn = ch.kind === "puzzle" && ch.puzzle && !ch.expired && !creator && started;

  if (puzzleOn && ch.puzzle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ paddingHorizontal: 12 }}>
          <TopBar title={t.titlePuzzle(name)} onBack={back} />
        </View>
        <PuzzlePlayer
          puzzle={ch.puzzle as Puzzle}
          onResult={(solved) => {
            setMine(solved);
            api.challengeResult(code, solved).then((r) => show(r.challenge), () => {});
          }}
          actions={mine === null ? null : <T role="label" center>{mine ? t.solved : t.missed}</T>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar onBack={back} />
      </View>
      <View style={{ flex: 1, gap: 12, paddingBottom: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <View style={{ alignItems: "center", gap: 8, paddingHorizontal: 16 }}>
          <AvatarFace id={ch.creator.avatar} size={56} />
          <T role="heading" header center>
            {creator ? t.yours : ch.kind === "puzzle" ? t.titlePuzzle(name) : t.titleGame(name)}
          </T>
          <View accessibilityLiveRegion="polite">
            <T role="body" color="textMuted" center>
              {ch.expired ? (ch.status === "waiting" && creator ? t.joinGone : t.expired) : ch.kind === "puzzle" ? (creator ? friendLine : t.bodyPuzzle) : gameLine}
            </T>
          </View>
        </View>
        {ch.kind === "game" && ch.status === "waiting" && creator && !ch.expired ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 16 }}>
            <View accessibilityRole="timer" accessibilityLabel={`${formatClock(joinLeft, "10m")} ${t.joinLeft}`} style={{ width: 200, height: 200, borderRadius: 100, borderWidth: 14, borderColor: joinLeft > JOIN_MS / 5 ? c.brand : c.danger, alignItems: "center", justifyContent: "center" }}>
              <T role="hero" style={{ fontVariant: ["tabular-nums"] }}>
                {formatClock(joinLeft, "10m")}
              </T>
              <T role="small" color="textMuted">
                {t.joinLeft}
              </T>
            </View>
            <T role="title" center>
              {t.waitingFriend}
            </T>
            <T role="small" color="textMuted" center style={{ maxWidth: 300 }}>
              {t.joinBody(tcName)}
            </T>
          </View>
        ) : ch.kind === "game" && play && ch.status !== "waiting" ? (
          <>
            {playerRow(ch.you === "w" ? "b" : "w")}
            <BoardStage top={null}>
              {(size, radius) => (
                <Board size={size} radius={radius} fen={play.fen} orientation={ch.you ?? "w"} selected={play.selected} targets={play.targets} lastMove={play.lastMove} check={play.check} onTap={(sq: Square) => act({ type: "tap", square: sq, now: Date.now() })} disabled={!ch.yourTurn || busy || ch.status !== "active"} />
              )}
            </BoardStage>
            {playerRow(ch.you ?? "w")}
          </>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {!creator && !ch.expired && ch.kind === "puzzle" ? <Button title={t.start} onPress={() => setStarted(true)} /> : null}
          {!creator && !ch.expired && ch.kind === "game" && ch.status === "waiting" ? <Button title={t.start} loading={busy} onPress={accept} /> : null}
          {creator && !ch.expired && ch.status !== "active" && ch.status !== "over" ? <Button title={t.sendAgain} variant="secondary" onPress={() => void shareLink(t.shareText, ch.url)} /> : null}
          {ch.kind === "game" && ch.status === "active" && ch.you ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={ch.drawOffer && ch.drawOffer !== ch.you ? t.acceptDraw : ch.drawOffer === ch.you ? t.drawSent : t.offerDraw}
                  variant={ch.drawOffer && ch.drawOffer !== ch.you ? "primary" : "secondary"}
                  disabled={busy || ch.drawOffer === ch.you}
                  onPress={() => endGame(api.challengeDraw)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={confirmResign ? t.resignSure : t.resign} variant={confirmResign ? "danger" : "secondary"} disabled={busy} onPress={() => (confirmResign ? (setConfirmResign(false), endGame(api.challengeResign)) : setConfirmResign(true))} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
