import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "./Button";
import { colors, font, radius, space, type } from "./theme";

export type CampusClass = { id: string; title: string; emoji: string; blurb: string; done: number; total: number; graduated: boolean; unlocked: boolean; examId?: string | null };
export type CampusSemester = { id: string; title: string; color: string; blurb: string; classes: CampusClass[] };
export type CampusStage = { id: string; name: string; emoji: string; blurb: string; optional?: boolean; semesters: CampusSemester[]; doneClasses: number; totalClasses: number; locked: boolean; cleared: boolean };

function Chevron({ open }: { open: boolean }) {
  return <Text style={[styles.chev, open && { transform: [{ rotate: "180deg" }] }]}>⌄</Text>;
}

function ProgressBar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone }]} />
    </View>
  );
}

function ClassCard({ cls, color, onOpen, onTestToUnlock, onTestOut }: { cls: CampusClass; color: string; onOpen: () => void; onTestToUnlock?: () => void; onTestOut?: () => void }) {
  return (
    <View style={[styles.classCard, { borderColor: cls.graduated ? colors.gold : colors.hairline }, !cls.unlocked && { opacity: 0.6 }]}>
      <View style={styles.classRow}>
        <View style={[styles.tile, { backgroundColor: cls.unlocked ? color + "1a" : colors.surfaceSunken }]}>
          <Text style={{ fontSize: 22 }}>{cls.unlocked ? cls.emoji : "🔒"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.classTitle} numberOfLines={1}>{cls.title}</Text>
            {cls.graduated && <Text style={{ fontSize: 13 }}>🎓</Text>}
          </View>
          <Text style={styles.classBlurb} numberOfLines={1}>{cls.blurb}</Text>
        </View>
        <Text style={styles.count}>{cls.done}/{cls.total}</Text>
      </View>
      <ProgressBar value={cls.done} max={cls.total} tone={cls.graduated ? colors.gold : colors.brand} />
      {cls.unlocked && (
        <View style={{ marginTop: space[3] }}>
          <Button
            label={cls.graduated ? "Review class" : cls.done > 0 ? "Continue" : "Start class"}
            variant={cls.graduated ? "outline" : "primary"}
            size="sm"
            onPress={onOpen}
          />
        </View>
      )}
      {cls.unlocked && cls.examId && !cls.graduated && onTestOut && (
        <View style={{ marginTop: space[2] }}>
          <Button label="📝 Test out" variant="outline" size="sm" onPress={onTestOut} />
        </View>
      )}
      {!cls.unlocked && onTestToUnlock && (
        <View style={{ marginTop: space[3] }}>
          <Button label="🎓 Test to unlock" variant="outline" size="sm" onPress={onTestToUnlock} />
        </View>
      )}
    </View>
  );
}

export function CampusMap({ stages }: { stages: CampusStage[] }) {
  const router = useRouter();

  // Default-expand the first semester that still has an unlocked, non-graduated class.
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
      {stages.map((stage, i) => {
        const descriptor = stage.blurb.split("·")[1]?.trim();
        const nextName = stages[i + 1]?.name;
        if (stage.locked) {
          return (
            <View key={stage.id} style={{ opacity: 0.7 }}>
              <View style={styles.lockedBanner}>
                <Text style={{ fontSize: 24 }}>🔒</Text>
                <Text style={styles.lockedName}>{stage.name}</Text>
                <Text style={styles.lockedSub}>Graduate the previous school to unlock · {stage.totalClasses} classes</Text>
              </View>
            </View>
          );
        }
        return (
          <View key={stage.id}>
            <View style={styles.stageHeader}>
              <Text style={{ fontSize: 20 }}>{stage.emoji}</Text>
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
                return (
                  <View key={sem.id}>
                    <Pressable style={styles.semHeader} onPress={() => toggle(sem.id)}>
                      <Text style={[styles.semPill, { backgroundColor: sem.color }]}>{sem.title}</Text>
                      <Text style={styles.semBlurb} numberOfLines={1}>{sem.blurb}</Text>
                      <Chevron open={o} />
                    </Pressable>
                    {o ? (
                      <View style={{ gap: space[3] }}>
                        {sem.classes.slice(0, shownOf(sem.id)).map((cls) => (
                          <ClassCard
                            key={cls.id}
                            cls={cls}
                            color={sem.color}
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

            {/* School exam — gateway to the next school */}
            {!stage.cleared && !stage.optional && nextName && (
              <Pressable style={styles.examBtn} onPress={() => router.push({ pathname: "/exam/school/[stage]", params: { stage: stage.id } })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examTitle}>📝 {stage.name} Exam</Text>
                  <Text style={styles.examSub}>Pass to unlock {nextName} →</Text>
                </View>
                <Text style={{ fontSize: 20 }}>🎓</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <View style={styles.endBanner}>
        <Text style={styles.endTitle}>🚧 More schools coming soon</Text>
        <Text style={styles.endSub}>New programs are being added — keep climbing the ladder!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chev: { fontSize: 16, color: colors.ink500, marginLeft: "auto", fontFamily: font.bold },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden", marginTop: space[3] },
  fill: { height: 10, borderRadius: radius.pill },
  classCard: { borderRadius: radius.card, borderWidth: 1, backgroundColor: colors.surfaceCard, padding: space[4], shadowColor: "#1c1b2e", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
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
  endSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", marginTop: space[1] },
  examBtn: { marginTop: space[4], flexDirection: "row", alignItems: "center", borderRadius: radius.card, borderWidth: 2, borderColor: "rgba(246,195,67,0.5)", backgroundColor: "#fdf6e0", paddingHorizontal: space[4], paddingVertical: space[3] },
  examTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  examSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  loadMore: { paddingVertical: space[3], alignItems: "center" },
  loadMoreText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
});
