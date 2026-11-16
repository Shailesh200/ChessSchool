import { defaultSetup, playReduce, startGame, type PlayAction, type PlayState, type Puzzle, type Square } from "@chessschool/chess";
import { copy, type Challenge } from "@chessschool/design";
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
import { useTheme } from "@/lib/theme";

const POLL_MS = 5000;

/**
 * A challenge link (chess-school.in/c/<code>): a puzzle to try, or a slow game with the friend who sent it.
 * No chat; a child's challenge shows an avatar and no name.
 */
export default function ChallengeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { cue } = useApp();
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

  const show = useCallback((next: Challenge) => {
    setCh(next);
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

  const polling = Boolean(ch && ch.kind === "game" && !ch.expired && ch.status !== "over" && !ch.yourTurn);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [polling, load]);

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
  const friendLine = ch.friendResult === "solved" ? t.friendSolved : ch.friendResult === "missed" ? t.friendMissed : t.friendPending;
  const gameLine = ch.status === "over" ? (ch.result === "1/2-1/2" ? copy.play.results.draw.title : copy.gym.friendWin(copy.play.sides[ch.result === "1-0" ? "w" : "b"])) : ch.status === "waiting" ? (creator ? t.yours : t.bodyGame) : ch.yourTurn ? copy.lesson.yourMove : t.waiting;
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
              {ch.expired ? t.expired : ch.kind === "puzzle" ? (creator ? friendLine : t.bodyPuzzle) : gameLine}
            </T>
          </View>
        </View>
        {ch.kind === "game" && play && (ch.status !== "waiting" || creator) ? (
          <BoardStage top={null}>
            {(size, radius) => (
              <Board size={size} radius={radius} fen={play.fen} orientation={ch.you ?? "w"} selected={play.selected} targets={play.targets} lastMove={play.lastMove} check={play.check} onTap={(sq: Square) => act({ type: "tap", square: sq, now: Date.now() })} disabled={!ch.yourTurn || busy} />
            )}
          </BoardStage>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {!creator && !ch.expired && ch.kind === "puzzle" ? <Button title={t.start} onPress={() => setStarted(true)} /> : null}
          {!creator && !ch.expired && ch.kind === "game" && ch.status === "waiting" ? <Button title={t.start} loading={busy} onPress={accept} /> : null}
          {creator && !ch.expired ? <Button title={copy.share.button} variant="secondary" onPress={() => void shareLink(t.shareText, ch.url)} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
