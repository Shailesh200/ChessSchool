import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { ProgressBar } from "./ProgressBar";
import { emojiToIcon } from "./iconMaps";
import { haptics } from "./haptics";
import { sfx } from "./sfx";
import { useAppTheme, type ThemeColors } from "./ThemeProvider";
import { useSettings } from "./settings";
import { useType } from "./typography";
import { font, radius, shadowCard, space } from "./theme";

export type CampusClass = { id: string; title: string; emoji: string; blurb: string; done: number; total: number; graduated: boolean; unlocked: boolean; examId?: string | null };
export type CampusSemester = { id: string; title: string; color: string; blurb: string; classes: CampusClass[] };
export type CampusStage = { id: string; name: string; emoji: string; blurb: string; optional?: boolean; semesters: CampusSemester[]; doneClasses: number; totalClasses: number; locked: boolean; cleared: boolean };

type TypeScale = ReturnType<typeof useType>;

function makeStyles(colors: ThemeColors, type: TypeScale) {
  return StyleSheet.create({
    chev: { fontSize: 16, color: colors.ink500, marginLeft: "auto", fontFamily: font.bold },
    classCard: { borderRadius: radius.card, borderWidth: 1, backgroundColor: colors.surfaceCard, padding: space[5], ...shadowCard },
    classRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
    tile: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    classTitle: { ...type.base, fontFamily: font.bold, color: colors.ink },
    classBlurb: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
    count: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
    stageHeader: { flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[3] },
    stageName: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    stageSub: { ...type.caption, fontFamily: font.semibold, color: colors.ink500 },
    optionalPill: { ...type.caption, fontFamily: font.bold, color: colors.ink500, backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
    semHeader: { flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[2] },
    semPill: { borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1], ...type.xs, fontFamily: font.bold, color: "#fff", overflow: "hidden" },
    semBlurb: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, flexShrink: 1 },
    teaser: { borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space[3], alignItems: "center" },
    teaserText: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
    lockedBanner: { borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: colors.hairline, backgroundColor: colors.surfaceSunken, padding: space[4], alignItems: "center" },
    lockedName: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
    lockedSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", marginTop: 2 },
    endBanner: { borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: colors.hairline, backgroundColor: colors.surfaceSunken, padding: space[4], alignItems: "center" },
    endTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    endTitleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
    endSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", marginTop: space[1] },
    examBtn: { marginTop: space[4], flexDirection: "row", alignItems: "center", borderRadius: radius.card, borderWidth: 2, borderColor: "rgba(246,195,67,0.5)", backgroundColor: colors.surfaceCard, paddingHorizontal: space[4], paddingVertical: space[3] },
    examTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    examTitleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
    examSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
    loadMore: { paddingVertical: space[3], alignItems: "center" },
    loadMoreText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
    pastToggle: { alignSelf: "flex-end", backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1] },
    pastToggleText: { ...type.xs, fontFamily: font.bold, color: colors.ink700 },
    clearedBanner: { borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(246,195,67,0.5)", backgroundColor: colors.surfaceCard, padding: space[4], alignItems: "center" },
    clearedTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
    clearedSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500 },
  });
}

function Chevron({ open, styles }: { open: boolean; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={[styles.chev, open && { transform: [{ rotate: "180deg" }] }]}>⌄</Text>;
}

function SpringIn({ index, reducedMotion, children }: { index: number; reducedMotion: boolean; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 14)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(14);
    const delay = Math.min(index, 5) * 60;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        stiffness: 260,
        damping: 24,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, reducedMotion, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function ClassCard({
  cls,
  color,
  index,
  reducedMotion,
  onOpen,
  onTestToUnlock,
  onTestOut,
  styles,
  colors,
}: {
  cls: CampusClass;
  color: string;
  index: number;
  reducedMotion: boolean;
  onOpen: () => void;
  onTestToUnlock?: () => void;
  onTestOut?: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  return (
    <SpringIn index={index} reducedMotion={reducedMotion}>
      <View style={[styles.classCard, { borderColor: cls.graduated ? colors.gold : colors.hairline }, !cls.unlocked && { opacity: 0.6 }]}>
        <View style={styles.classRow}>
          <View style={[styles.tile, { backgroundColor: cls.unlocked ? color + "1a" : colors.surfaceSunken }]}>
            <Icon name={cls.unlocked ? emojiToIcon(cls.emoji) : "lock"} size={22} color={cls.unlocked ? colors.brand : colors.ink500} duotone />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.classTitle} numberOfLines={1}>{cls.title}</Text>
              {cls.graduated && <Icon name="cap" size={13} color={colors.gold} />}
            </View>
            <Text style={styles.classBlurb} numberOfLines={1}>{cls.blurb}</Text>
          </View>
          <Text style={styles.count}>{cls.done}/{cls.total}</Text>
        </View>
        <ProgressBar value={cls.done} max={cls.total} tone={cls.graduated ? "gold" : "brand"} />
        {cls.unlocked && (
          <View style={{ marginTop: space[3] }}>
            <Button
              testID={`class-${cls.id}`}
              label={cls.graduated ? "Review class" : cls.done > 0 ? "Continue" : "Start class"}
              variant={cls.graduated ? "outline" : "primary"}
              size="sm"
              haptic={false}
              onPress={() => {
                haptics.tap();
                sfx.play("transition");
                onOpen();
              }}
            />
          </View>
        )}
        {cls.unlocked && cls.examId && !cls.graduated && onTestOut && (
          <View style={{ marginTop: space[2] }}>
            <Button
              label="Test out"
              variant="outline"
              size="sm"
              haptic={false}
              onPress={() => {
                haptics.tap();
                sfx.play("exam");
                onTestOut();
              }}
            />
          </View>
        )}
        {!cls.unlocked && onTestToUnlock && (
          <View style={{ marginTop: space[3] }}>
            <Button
              label="Test to unlock"
              variant="outline"
              size="sm"
              haptic={false}
              onPress={() => {
                haptics.tap();
                sfx.play("transition");
                onTestToUnlock();
              }}
            />
          </View>
        )}
        {!cls.unlocked && !onTestToUnlock && (
          <Pressable
            style={{ marginTop: space[3], paddingVertical: space[2], alignItems: "center" }}
            onPress={() => {
              haptics.error();
              sfx.play("fail");
            }}
          >
            <Text style={styles.classBlurb}>Locked — graduate the previous class</Text>
          </Pressable>
        )}
      </View>
    </SpringIn>
  );
}

export function CampusMap({ stages }: { stages: CampusStage[] }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const type = useType();
  const { reducedMotion } = useSettings();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const allClasses = useMemo(
    () => stages.flatMap((st) => st.semesters.flatMap((sem) => sem.classes)),
    [stages],
  );
  const pastIds = useMemo(() => {
    const frontierIdx = allClasses.findIndex((c) => !c.graduated);
    const end = frontierIdx === -1 ? allClasses.length : frontierIdx;
    return new Set(allClasses.slice(0, end).map((c) => c.id));
  }, [allClasses]);
  const defaultOpen = useMemo(() => {
    for (const st of stages) {
      if (st.locked) continue;
      for (const sem of st.semesters) {
        if (sem.classes.some((c) => c.unlocked && !c.graduated)) return sem.id;
      }
    }
    return stages.find((s) => !s.locked)?.semesters[0]?.id ?? null;
  }, [stages]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState<Record<string, number>>({});
  const previousClassId = useMemo(() => {
    const ids = stages.flatMap((stage) => stage.semesters.flatMap((sem) => sem.classes.map((cls) => cls.id)));
    return new Map(ids.map((classId, index) => [classId, index > 0 ? ids[index - 1] : null]));
  }, [stages]);
  const isOpen = (id: string) => open[id] ?? id === defaultOpen;
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !isOpen(id) }));
  const shownOf = (id: string) => more[id] ?? 6;

  return (
    <View style={{ gap: space[8] }}>
      {pastIds.size > 0 && (
        <Pressable style={styles.pastToggle} onPress={() => setShowCompleted((v) => !v)}>
          <Text style={styles.pastToggleText}>
            {showCompleted ? "Hide" : "Show"} past classes ({pastIds.size})
          </Text>
        </Pressable>
      )}
      {stages.map((stage, i) => {
        const descriptor = stage.blurb.split("·")[1]?.trim();
        const nextName = stages[i + 1]?.name;
        if (stage.locked) {
          return (
            <View key={stage.id} style={{ opacity: 0.7 }}>
              <View style={styles.lockedBanner}>
                <Icon name="lock" size={24} color={colors.ink500} />
                <Text style={styles.lockedName}>{stage.name}</Text>
                <Text style={styles.lockedSub}>Graduate the previous school to unlock · {stage.totalClasses} classes</Text>
              </View>
            </View>
          );
        }
        if (stage.cleared && !expandedStages[stage.id]) {
          return (
            <Pressable
              key={stage.id}
              style={styles.clearedBanner}
              onPress={() => setExpandedStages((e) => ({ ...e, [stage.id]: true }))}
            >
              <Icon name="cap" size={22} color={colors.gold} duotone />
              <Text style={styles.clearedTitle}>{stage.name} — graduated</Text>
              <Text style={styles.clearedSub}>Tap to review classes</Text>
            </Pressable>
          );
        }
        return (
          <View key={stage.id}>
            <View style={styles.stageHeader}>
              <Icon name={emojiToIcon(stage.emoji)} size={20} color={colors.brand} duotone />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <Text style={styles.stageName} numberOfLines={1}>{stage.name}</Text>
                  {stage.optional && (
                    <Text style={styles.optionalPill}>Optional</Text>
                  )}
                </View>
                <Text style={styles.stageSub} numberOfLines={1}>
                  {stage.totalClasses} classes{descriptor ? ` · ${descriptor}` : ""}{stage.optional ? " · skip if you know the rules" : ""}
                </Text>
              </View>
            </View>

            <View style={{ gap: space[5] }}>
              {stage.semesters.map((sem) => {
                const o = isOpen(sem.id);
                const visible = sem.classes
                  .slice(0, shownOf(sem.id))
                  .filter((cls) => showCompleted || !pastIds.has(cls.id));
                return (
                  <View key={sem.id}>
                    <Pressable style={styles.semHeader} onPress={() => toggle(sem.id)}>
                      <Text style={[styles.semPill, { backgroundColor: sem.color }]}>{sem.title}</Text>
                      <Text style={styles.semBlurb} numberOfLines={1}>{sem.blurb}</Text>
                      <Chevron open={o} styles={styles} />
                    </Pressable>
                    {o ? (
                      <View style={{ gap: space[3] }}>
                        {visible.map((cls, cardIdx) => (
                          <ClassCard
                            key={cls.id}
                            cls={cls}
                            color={sem.color}
                            index={cardIdx}
                            reducedMotion={reducedMotion}
                            styles={styles}
                            colors={colors}
                            onOpen={() => router.push({ pathname: "/class/[id]", params: { id: cls.id } })}
                            onTestToUnlock={
                              cls.unlocked
                                ? undefined
                                : (() => {
                                    const prevId = previousClassId.get(cls.id);
                                    return prevId ? () => router.push({ pathname: "/class/[id]/exam", params: { id: prevId } }) : undefined;
                                  })()
                            }
                            onTestOut={cls.examId ? () => router.push({ pathname: "/lesson/[id]", params: { id: cls.examId! } }) : undefined}
                          />
                        ))}
                        {shownOf(sem.id) < sem.classes.length && (
                          <Pressable style={styles.loadMore} onPress={() => setMore((m) => ({ ...m, [sem.id]: shownOf(sem.id) + 6 }))}>
                            <Text style={styles.loadMoreText}>Show {Math.min(6, sem.classes.length - shownOf(sem.id))} more classes ▾</Text>
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <Pressable style={styles.teaser} onPress={() => toggle(sem.id)}>
                        <Text style={styles.teaserText}>{sem.classes.length} classes — tap to preview</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>

            {!stage.cleared && !stage.optional && nextName && (
              <Pressable
                style={styles.examBtn}
                onPress={() => {
                  haptics.tap();
                  sfx.play("exam");
                  router.push({ pathname: "/exam/school/[stage]", params: { stage: stage.id } });
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.examTitleRow}>
                    <Icon name="journal" size={16} color={colors.ink} />
                    <Text style={styles.examTitle}>{stage.name} Exam</Text>
                  </View>
                  <Text style={styles.examSub}>Pass to unlock {nextName} →</Text>
                </View>
                <Icon name="cap" size={20} color={colors.gold} duotone />
              </Pressable>
            )}
          </View>
        );
      })}

      <View style={styles.endBanner}>
        <View style={styles.endTitleRow}>
          <Icon name="warning" size={18} color={colors.ink500} />
          <Text style={styles.endTitle}>More schools coming soon</Text>
        </View>
        <Text style={styles.endSub}>New programs are being added — keep climbing the ladder!</Text>
      </View>
    </View>
  );
}
