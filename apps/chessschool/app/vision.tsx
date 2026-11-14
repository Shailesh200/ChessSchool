import { startVision, VISION_GAMES, VISION_SECONDS, visionAnswer, visionFen, type MoveRef, type Square, type VisionGame, type VisionPlay } from "@chessschool/chess";
import { copy, type IconName } from "@chessschool/design";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { Cody } from "@/components/Lottie";
import { Button, Card, Flow, Page, Row, T, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const ICONS: Record<VisionGame, IconName> = { name: "eye", attack: "bolt", knight: "spark" };

/** Board vision: three 30-second games. Bests stay on the device; signed in, each run counts toward today's class best. */
export default function Vision() {
  const { state, finishVision, cue } = useApp();
  const { c } = useTheme();
  const [game, setGame] = useState<VisionGame | null>(null);
  const [play, setPlay] = useState<VisionPlay | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ score: number; best: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [reveal, setReveal] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<MoveRef | null>(null);
  const t = copy.vision;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [play]);

  useEffect(() => {
    if (!play || !game || left > 0) return;
    setResult({ score: play.score, best: state.vision[game] ?? 0 });
    finishVision(game, play.score);
    cue(play.score > (state.vision[game] ?? 0) ? "level-up" : "success");
    setPlay(null);
    setReveal([]);
    // Only the clock reaching zero matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const start = (g: VisionGame) => {
    const at = Date.now();
    setGame(g);
    setResult(null);
    setLastMove(null);
    setEndsAt(at + VISION_SECONDS * 1000);
    setNow(at);
    setPlay(startVision(g));
  };

  const answer = (sq: Square) => {
    if (!play || reveal.length) return;
    const r = visionAnswer(play, sq);
    if (r.result === "none") {
      if (play.round.game === "knight") setShake((n) => n + 1);
      return;
    }
    if (r.result === "miss") {
      setShake((n) => n + 1);
      cue("gentle-no");
      if (play.round.game === "attack") {
        // Show the squares that were left, then the next piece.
        setReveal(r.missed);
        setTimeout(() => {
          setReveal([]);
          setPlay((p) => (p ? r.play : p));
        }, 800);
        return;
      }
    } else cue(r.play.score > play.score && play.round.game !== "attack" ? "success" : "tap");
    if (play.round.game === "knight") setLastMove({ from: play.round.from, to: sq });
    setPlay(r.play);
  };

  if (!game) {
    return (
      <Page title={t.title}>
        <T role="bodyLg" color="textMuted">
          {t.body}
        </T>
        <Card style={{ paddingVertical: 4 }}>
          {VISION_GAMES.map((g) => (
            <Row key={g} icon={ICONS[g]} label={t.games[g].name} hint={`${t.games[g].body} ${t.best(state.vision[g] ?? 0)}`} onPress={() => setGame(g)} chevron />
          ))}
        </Card>
      </Page>
    );
  }

  const info = t.games[game];
  if (!play) {
    const beat = result && result.score > result.best;
    return (
      <Flow top={<TopBar onBack={() => setGame(null)} />} footer={<Button title={result ? t.again : t.start} icon="bolt" onPress={() => start(game)} />}>
        <Cody animation={result ? "celebrate" : "wow"} size={150} label={copy.a11y.mascot} />
        <T role="title" header center>
          {result ? t.over : info.name}
        </T>
        <T role="bodyLg" color="textMuted" center>
          {result ? t.score(result.score) : info.body}
        </T>
        {beat ? (
          <T role="label" color="brandText">
            {copy.puzzles.newBest}
          </T>
        ) : null}
        <T role="small" color="textMuted">
          {t.best(state.vision[game] ?? 0)}
        </T>
      </Flow>
    );
  }

  const r = play.round;
  const prompt = r.game === "attack" ? `${t.games.attack.prompt(t.pieces[r.piece])} ${t.found(r.found.length, r.targets.length)}` : t.games[r.game].prompt;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={info.name} onBack={() => (setPlay(null), setGame(null))} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <T role="body" center>
          {prompt}
        </T>
        <BoardStage
          top={
            <>
              <View accessibilityRole="timer" style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: left <= 5 ? c.danger : c.brand }}>
                <T role="label" style={{ color: c.onBrand, fontFamily: fonts.bold }}>
                  {copy.puzzles.timeLeft(left)}
                </T>
              </View>
              <T role="label" style={{ flex: 1 }}>
                {t.score(play.score)}
              </T>
            </>
          }
        >
          {(size, radius) => (
            <Board
              size={size}
              radius={radius}
              fen={visionFen(r)}
              label={t.title}
              hideCoords={r.game === "name"}
              highlight={r.game === "name" ? [r.square] : r.game === "attack" ? r.found : []}
              stars={r.game === "knight" ? [r.target] : []}
              hints={reveal}
              lastMove={r.game === "knight" ? lastMove : null}
              shake={shake}
              disabled={r.game === "name" || reveal.length > 0}
              onTap={r.game === "name" ? undefined : answer}
            />
          )}
        </BoardStage>
        {r.game === "name" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 12 }}>
            {r.choices.map((sq) => (
              <View key={sq} style={{ flexBasis: "45%", flexGrow: 1 }}>
                <Button title={sq} variant="secondary" onPress={() => answer(sq)} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
