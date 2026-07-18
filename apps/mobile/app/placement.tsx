import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { BackButton } from "@/BackButton";
import { api } from "@/api";
import { mutateProgress } from "@/progressStore";
import { graduateClass } from "@/progression";
import { invalidateLearnCache } from "@/useLearnData";
import { placementStageIndex } from "@/classExam";
import { settings } from "@/settings";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { useAuth } from "@/auth";
import { ScreenLoader } from "@/ScreenLoader";
import { colors, font, radius, space, type } from "@/theme";

type Puzzle = { fen: string; solution: string[] };
type PlacementStage = { id: string; name: string; classIds: string[] };

const STAGE_ORDER = ["elementary", "middle", "high"] as const;
const STAGE_NAMES: Record<(typeof STAGE_ORDER)[number], string> = {
  elementary: "Elementary",
  middle: "Middle School",
  high: "High School",
};

export default function PlacementScreen() {
  const router = useRouter();
  const { guest, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [stages, setStages] = useState<PlacementStage[]>([]);
  const [i, setI] = useState(0);
  const correctRef = useRef(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [displayFen, setDisplayFen] = useState<string | undefined>();
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [savingPlacement, setSavingPlacement] = useState(false);

  async function loadPuzzles() {
    setLoadError(false);
    setPuzzles(null);
    try {
      const [placement, catalog] = await Promise.all([
        api<{ puzzles: Puzzle[] }>("/api/placement"),
        api<{
          semesters: { id: string; stage: string }[];
          classes: { id: string; semesterId: string }[];
        }>("/api/catalog"),
      ]);
      const built: PlacementStage[] = STAGE_ORDER.map((id) => {
        const semesterIds = new Set(catalog.semesters.filter((s) => s.stage === id).map((s) => s.id));
        const classIds = catalog.classes.filter((c) => semesterIds.has(c.semesterId)).map((c) => c.id);
        return { id, name: STAGE_NAMES[id], classIds };
      }).filter((s) => s.classIds.length > 0);
      setStages(built);
      // Shuffle so consecutive runs don't feel identical (pool order is curriculum-sorted).
      const pool = [...(placement.puzzles ?? [])];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      setPuzzles(pool);
    } catch {
      setLoadError(true);
      setPuzzles([]);
      setStages([]);
    }
  }

  useEffect(() => {
    if (!authLoading && guest) router.replace("/login");
  }, [authLoading, guest, router]);

  useEffect(() => {
    if (guest) return;
    void loadPuzzles();
  }, [guest]);

  if (!puzzles) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLoader variant="fullscreen" label="Preparing placement puzzles…" />
      </SafeAreaView>
    );
  }

  async function admitStage(targetIdx: number, elo: number) {
    if (savingPlacement) return;
    setSavingPlacement(true);
    settings.set("targetElo", elo);
    const classIds = stages.slice(0, targetIdx).flatMap((s) => s.classIds);
    try {
      await mutateProgress((snap) => {
        let next: Record<string, unknown> = { ...snap, rating: elo, placementDone: true };
        for (const cid of classIds) next = graduateClass(next, cid);
        return next;
      });
      invalidateLearnCache();
      router.replace("/(tabs)/academy");
    } catch {
      setSavingPlacement(false);
      setLoadError(true);
    }
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Cody expression="sad" size={120} />
          <Text style={styles.doneTitle}>Placement couldn't load</Text>
          <Text style={styles.doneSub}>Check your connection and try again. We won't place you until the puzzles are loaded.</Text>
          <View style={{ marginTop: space[5], width: 260, gap: space[2] }}>
            <Button label="Try again" variant="success" onPress={loadPuzzles} />
            <Button label="Back to academy" variant="outline" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (puzzles.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Cody expression="sad" size={120} />
          <Text style={styles.doneTitle}>No placement puzzles yet</Text>
          <Text style={styles.doneSub}>Start from the academy while we prepare a placement set for you.</Text>
          <View style={{ marginTop: space[5], width: 260 }}>
            <Button label="Back to academy" variant="outline" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    const pct = puzzles.length ? correctRef.current / puzzles.length : 0;
    const maxIdx = Math.max(0, stages.length - 1);
    const targetIdx = placementStageIndex(pct, maxIdx);
    const target = stages[targetIdx] ?? stages[0]!;
    const elo = targetIdx >= 2 ? 1400 : targetIdx === 1 ? 1000 : 600;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          {savingPlacement ? (
            <ScreenLoader label="Saving your placement…" />
          ) : (
            <>
              <Cody expression="cheer" size={140} />
              <Text style={styles.doneTitle}>You scored {correctRef.current}/{puzzles.length}</Text>
              <Text style={styles.doneSub}>
                Based on your test, we recommend starting at {target.name}.
              </Text>
              <View style={{ marginTop: space[5], width: 280, gap: space[2] }}>
                <Button
                  label={`Start at ${target.name} →`}
                  variant="success"
                  onPress={() => admitStage(targetIdx, elo)}
                />
                <Button
                  label="Start from the beginning"
                  variant="outline"
                  onPress={() => admitStage(0, 600)}
                />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const puzzle = puzzles[i]!;
  const turn = puzzle.fen.split(" ")[1] === "b" ? "Black" : "White";
  const mood: CodyExpression = feedback === "correct" ? "cheer" : feedback === "wrong" ? "sad" : "think";

  function onMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (feedback) return false;
    const e = new ChessEngine(puzzle.fen);
    const mv = e.move({ from, to, promotion });
    if (!mv) return false;
    const ok = puzzle.solution.includes(`${from}:${to}`);
    setDisplayFen(e.fen());
    setLastMove({ from, to });
    if (ok) {
      correctRef.current += 1;
      haptics.success();
      sfx.play("success");
    } else {
      haptics.error();
      sfx.play("error");
    }
    setFeedback(ok ? "correct" : "wrong");
    setTimeout(() => {
      if (i + 1 >= (puzzles?.length ?? 0)) setDone(true);
      else {
        setFeedback(null);
        setDisplayFen(undefined);
        setLastMove(null);
        setI((n) => n + 1);
      }
    }, 750);
    return true;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
        <View style={styles.topCenter}>
          <Text testID="placement-title" style={styles.eyebrow}>
            Placement test
          </Text>
          <Text style={styles.progress}>Question {i + 1} of {puzzles.length} · find the best move</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.body}>
        <Cody expression={mood} size={72} />
        <Text style={styles.prompt}>{feedback === "correct" ? "Correct!" : feedback === "wrong" ? "Not quite — keep going" : `${turn} to play`}</Text>
        <ChessBoard fen={displayFen ?? puzzle.fen} size={boardSize} onMove={onMove} lastMove={lastMove} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5] },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], paddingTop: 6 },
  topCenter: { flex: 1, alignItems: "center", paddingHorizontal: space[2] },
  eyebrow: { ...type.caption, fontFamily: font.bold, color: colors.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  progress: { ...type.sm, fontFamily: font.bold, color: colors.ink500, textAlign: "center", marginTop: 2 },
  body: { flex: 1, alignItems: "center", padding: space[4], gap: space[3] },
  prompt: { ...type.base, fontFamily: font.bold, color: colors.ink },
  doneTitle: { ...type.xl, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  doneSub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", marginTop: space[2], lineHeight: 22 },
});
