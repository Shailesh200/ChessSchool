import { badgeKind, BADGES, copy, earnedBadges, focusCourse, isUnitBadge, unitFinishDay, type BadgeId, type BadgeKind } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Page, Sheet, T, Button } from "@/components/ui";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

type Filter = "all" | "certs" | "badges";

/** Achievements and certificates together: finished units are certificates, every other achievement a badge. */
export default function Trophies() {
  const { state } = useApp();
  const { c } = useTheme();
  const course = useCourse();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<BadgeId | null>(null);
  const t = copy.trophies;
  const earned = earnedBadges(state.progress, state.ratings);
  const badges = BADGES.filter((b) => !isUnitBadge(b.id)).sort((a, b) => Number(earned.includes(b.id)) - Number(earned.includes(a.id)));
  const certs = state.account && course ? [...focusCourse(course, state.progress.completed).unitsDone].reverse() : [];
  const tones: Record<BadgeKind, { bg: string; icon: "spark" | "trophy" | "star" | "practice" | "learn" }> = {
    streak: { bg: c.danger, icon: "spark" },
    win: { bg: c.success, icon: "trophy" },
    puzzle: { bg: c.gold, icon: "star" },
    practice: { bg: c.brand, icon: "practice" },
    learn: { bg: c.accent, icon: "learn" },
  };
  const chips: [Filter, string][] = [
    ["all", t.all],
    ["certs", t.certificates],
    ["badges", t.badges],
  ];
  const tile = (id: BadgeId, big = false) => {
    const on = earned.includes(id);
    const tone = tones[badgeKind(id)];
    const size = big ? 96 : 54;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 3, alignItems: "center", justifyContent: "center", backgroundColor: on ? tone.bg : c.line, borderBottomWidth: on ? 4 : 0, borderColor: "rgba(0,0,0,0.15)" }}>
        <Icon name={on ? tone.icon : "lock"} size={big ? 44 : 24} color={on ? "#fff" : c.textMuted} />
      </View>
    );
  };
  const opened = open ? copy.badges.list[open] : null;
  return (
    <Page title={t.title} banner={false}>
      <T role="small" color="textMuted" style={{ marginTop: -8 }}>
        {t.summary(earned.filter((id) => !isUnitBadge(id)).length, badges.length, certs.length)}
      </T>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>
        {chips.map(([id, label]) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: filter === id }} onPress={() => setFilter(id)} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: filter === id ? c.text : c.card, borderWidth: filter === id ? 0 : 1, borderColor: c.line }}>
            <T role="small" style={{ fontFamily: fonts.bold, color: filter === id ? c.bg : c.text }}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>

      {filter !== "badges" ? (
        certs.length ? (
          certs.map((u) => {
            const day = course ? unitFinishDay(course, state.progress.completed, u.id) : null;
            return (
              <Pressable key={u.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/certificate", params: { unit: u.id } })} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 22, backgroundColor: c.goldSoft, borderWidth: 1.5, borderColor: c.gold }}>
                <View style={{ width: 64, height: 80, borderRadius: 10, backgroundColor: c.card, borderWidth: 2, borderColor: c.gold, alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Icon name="trophy" size={26} color={c.goldText} />
                  <View style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: c.gold }} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <T role="eyebrow" style={{ color: c.goldText, fontSize: 11 }}>
                    {t.certKicker}
                  </T>
                  <T role="heading" numberOfLines={2}>
                    {u.title.replace(/^Unit \d+ · /, "")}
                  </T>
                  {day ? (
                    <T role="small" color="textMuted">
                      {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </T>
                  ) : null}
                </View>
                <Icon name="chevron" size={20} color={c.goldText} />
              </Pressable>
            );
          })
        ) : (
          <T role="small" color="textMuted">
            {state.account ? t.noCerts : t.signIn}
          </T>
        )
      ) : null}

      {filter !== "certs" ? (
        <View accessibilityRole="list" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {badges.map((b) => {
            const on = earned.includes(b.id);
            const bc = copy.badges.list[b.id];
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`${bc.name}. ${bc.body}${on ? "" : ` (${copy.you.badgeLocked})`}`}
                onPress={() => setOpen(b.id)}
                style={{ width: "31%", flexGrow: 1, alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 18, backgroundColor: on ? c.card : c.sunken, borderWidth: on ? 1 : 0, borderColor: c.line }}
              >
                {tile(b.id)}
                <T role="micro" center numberOfLines={2} style={{ fontFamily: fonts.bold }}>
                  {bc.name}
                </T>
                <T role="micro" color="textMuted" center numberOfLines={2}>
                  {bc.body}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <T role="small" color="textMuted" center>
        {t.hint}
      </T>

      <Sheet visible={open !== null} onClose={() => setOpen(null)}>
        {open && opened ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            {tile(open, true)}
            <T role="title" center>
              {opened.name}
            </T>
            <T role="body" color="textMuted" center>
              {opened.body}
            </T>
            <Button title={copy.analysis.close} variant="secondary" onPress={() => setOpen(null)} />
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}
