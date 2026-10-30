import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { KitButton, KitIcon, KitSheet, usePremiumKitTheme } from "@/components/kit";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { api } from "@/api";
import { useNetwork } from "@/NetworkProvider";
import { useLearnData } from "@/useLearnData";
import { useProgress } from "@/progressStore";
import {
  filterGymPuzzles,
  gymLevelOf,
  gymSkillOf,
  statusSheetCopy,
  type GymLevel,
  type GymPuzzle,
  type GymSkill,
  type StatusSheetKind,
} from "./premiumModel";

const SKILLS: GymSkill[] = ["All", "Forks", "Pins", "Skewers", "Mates", "Endgames"];
const LEVELS: GymLevel[] = ["All", "Easy", "Medium", "Hard"];

type Lesson = { id: string; title: string; emoji?: string };

export function PremiumGymScreen({ fixture }: { fixture?: { puzzles: GymPuzzle[]; dailyTitle?: string; sheet?: StatusSheetKind | null } }) {
  const router = useRouter();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const { isConnected } = useNetwork();
  const progress = useProgress();
  const learn = useLearnData();
  const [lessons, setLessons] = useState<Lesson[] | null>(fixture ? [] : null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState<GymSkill>("All");
  const [level, setLevel] = useState<GymLevel>("All");
  const [sheet, setSheet] = useState<StatusSheetKind | null>(fixture?.sheet ?? null);

  useEffect(() => {
    if (fixture) return;
    void api<{ groups: { lessons: Lesson[] }[] }>("/api/library")
      .then((data) => {
        setLessons((data.groups ?? []).flatMap((group) => group.lessons ?? []));
        setFailed(false);
      })
      .catch(() => {
        setLessons([]);
        setFailed(true);
      });
  }, [fixture]);

  const puzzles = useMemo(() => {
    if (fixture) return fixture.puzzles;
    const solved = new Set(
      Object.entries((progress?.lessons ?? {}) as Record<string, { mastery?: number }>)
        .filter(([, row]) => (row?.mastery ?? 0) >= 0.9)
        .map(([id]) => id),
    );
    return (lessons ?? []).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      skill: gymSkillOf(lesson.title),
      level: gymLevelOf(lesson.title),
      solved: solved.has(lesson.id),
    }));
  }, [fixture, lessons, progress]);
  const shown = filterGymPuzzles(puzzles, { q, skill, level });
  const dailyTitle = fixture?.dailyTitle ?? learn.data?.daily?.title ?? "Daily puzzle";
  const dailyId = learn.data?.daily?.lessonId;

  useEffect(() => {
    if (fixture?.sheet !== undefined) return;
    if (!isConnected) setSheet("offline");
    else if (failed) setSheet("error");
    else if (lessons && shown.length === 0 && q === "" && skill === "All" && level === "All") setSheet("empty");
    else setSheet(null);
  }, [fixture?.sheet, isConnected, failed, lessons, shown.length, q, skill, level]);

  const copy = sheet ? statusSheetCopy(sheet) : null;

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView testID="gym-screen" contentContainerStyle={{ padding: space["4"], paddingBottom: 120, gap: space["3"] }}>
        <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.h1.fontSize }}>Gym</Text>
        <Text style={{ color: colors.ink500, fontFamily: font.uiMedium, marginTop: -8 }}>Short puzzles to sharpen one skill at a time.</Text>
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space["4"], gap: space["2"] }}>
          <Text style={{ fontFamily: font.uiBold, color: colors.ink500, letterSpacing: 1, textTransform: "uppercase" }}>Daily puzzle</Text>
          <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.h3.fontSize }}>{dailyTitle}</Text>
          <Text style={{ color: colors.ink500 }}>A new one every day. Takes about 2 minutes.</Text>
          <KitButton label="Solve it" variant="accent" disabled={!dailyId && !fixture} onPress={() => dailyId && router.push({ pathname: "/lesson/[id]", params: { id: dailyId, daily: "1" } })} />
        </View>
        <Text style={{ fontFamily: font.uiBold, color: colors.ink }}>Search puzzles</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surfaceCard }}>
          <KitIcon name="search" size={18} color={colors.ink500} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={colors.ink300} style={{ flex: 1, height: 48, color: colors.ink, fontFamily: font.uiMedium }} />
        </View>
        <ChipRow options={SKILLS} value={skill} onChange={setSkill} />
        <ChipRow options={LEVELS} value={level} onChange={setLevel} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.h3.fontSize }}>Puzzles</Text>
          <Text testID="gym-count" style={{ color: colors.ink500 }}>{shown.length} shown</Text>
        </View>
        {shown.map((puzzle) => (
          <Pressable key={puzzle.id} testID={`gym-${puzzle.id}`} onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: puzzle.id } })} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: colors.brandSoft }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>{puzzle.title}</Text>
              <Text style={{ color: colors.ink500 }}>{puzzle.solved ? "Solved" : "Not tried yet"}</Text>
              <Text style={{ color: colors.ink500 }}>{puzzle.skill} · {puzzle.level}</Text>
            </View>
            {puzzle.solved ? <Text style={{ color: colors.brand, fontFamily: font.uiBold }}>Done</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
      <KitSheet open={Boolean(copy)} onClose={() => setSheet(null)} title={copy?.title}>
        {copy ? (
          <View style={{ gap: space["3"] }}>
            <Text style={{ color: colors.ink500, fontFamily: font.uiMedium, textAlign: "center" }}>{copy.body}</Text>
            <KitButton label={copy.primary} icon={sheet === "empty" ? "dumbbell" : "refreshCw"} onPress={() => { if (sheet === "error" || sheet === "offline") setFailed(false); setSheet(null); }} />
            <KitButton label={copy.secondary} variant="ghost" onPress={() => setSheet(null)} />
          </View>
        ) : null}
      </KitSheet>
    </ThemedSafeArea>
  );
}

function ChipRow<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (value: T) => void }) {
  const { colors, font, radius, space } = usePremiumKitTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"] }}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable key={option} onPress={() => onChange(option)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: on ? colors.brand : colors.surfaceCard, borderWidth: 1, borderColor: on ? colors.brand : colors.hairline }}>
            <Text style={{ color: on ? colors.textOnBrand : colors.ink, fontFamily: font.uiBold }}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
