import { BADGES, cleanName, copy, dayKey, earnedBadges, ideasLearned, rankFor, visibleStreak, type DailyMinutes } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, IconButton, Page, Row, SaveBanner, Segmented, Sheet, T, TextField, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

export default function You() {
  const { state, setProfile, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "name" | "goal" | "badges">(null);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const { profile, progress, account } = state;
  const rank = rankFor(progress.xp);
  const earned = earnedBadges(progress);
  const initial = (profile.name.trim()[0] ?? "").toUpperCase();
  const ordered = [...BADGES].sort((a, b) => Number(earned.includes(b.id)) - Number(earned.includes(a.id)));

  const saveName = () => {
    const clean = cleanName(draft);
    if (!clean) {
      setNameError(copy.auth.errors.nameRequired);
      return cue("gentle-no");
    }
    setProfile({ name: clean });
    setSheet(null);
    cue("success");
    toast(copy.you.nameSaved(clean));
    if (account) api.updateMe({ name: clean }).catch(() => {});
  };

  const setGoal = (m: DailyMinutes) => {
    setProfile({ dailyMinutes: m });
    cue("tap");
    if (account) api.updateMe({ dailyMinutes: m }).catch(() => {});
  };

  const stats = [
    { value: visibleStreak(progress.streak, dayKey(new Date())), label: copy.you.stats.streak, icon: "spark" as const, tint: c.accent },
    { value: progress.xp, label: copy.you.stats.xp, icon: "bolt" as const, tint: c.gold },
    { value: progress.puzzles.rating, label: copy.you.stats.rating, icon: "puzzle" as const, tint: c.brandText },
    { value: ideasLearned(progress), label: copy.you.stats.ideas, icon: "learn" as const, tint: c.successText },
    { value: progress.games.played, label: copy.you.stats.games, icon: "gym" as const, tint: c.brandText },
    { value: progress.games.won, label: copy.you.stats.won, icon: "trophy" as const, tint: c.goldText },
  ];

  const badge = (id: (typeof BADGES)[number]["id"], wide?: boolean) => {
    const on = earned.includes(id);
    const bc = copy.badges.list[id];
    return (
      <View
        key={id}
        accessible
        accessibilityLabel={`${bc.name}. ${bc.body}${on ? "" : ` (${copy.you.badgeLocked})`}`}
        style={{ width: wide ? undefined : 112, flexGrow: wide ? 1 : 0, flexBasis: wide ? "45%" : undefined, alignItems: "center", gap: 4, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 18, backgroundColor: on ? c.goldSoft : c.sunken }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.card, opacity: on ? 1 : 0.7 }}>
          <Icon name={on ? "trophy" : "lock"} color={on ? c.goldText : c.textMuted} size={22} />
        </View>
        <T role="small" center numberOfLines={2} style={{ alignSelf: "stretch", fontFamily: fonts.semibold, color: on ? c.text : c.textMuted }}>
          {bc.name}
        </T>
        {wide ? (
          <T role="micro" color="textMuted" center style={{ alignSelf: "stretch" }}>
            {bc.body}
          </T>
        ) : null}
      </View>
    );
  };

  return (
    <Page title={copy.you.title} large action={<IconButton icon="settings" label={copy.you.settings} onPress={() => router.push("/settings")} />}>
      <Card tone="hero" style={{ gap: 14, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: c.card, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 3, borderColor: c.brand }}>
            {initial ? (
              <T role="title" color="brandText">
                {initial}
              </T>
            ) : (
              <Cody animation="idle" size={60} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.name.trim() || copy.you.noName}. ${copy.you.editName}`}
              onPress={() => {
                setDraft(profile.name);
                setNameError(null);
                setSheet("name");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <T role="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                {profile.name.trim() || copy.you.noName}
              </T>
              <Icon name="edit" size={18} color={c.textMuted} />
            </Pressable>
            <T role="small" color="textMuted">
              {copy.today.level(copy.ranks[rank.rank], rank.level)}
            </T>
            <View style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, minHeight: 24, borderRadius: 12, justifyContent: "center", backgroundColor: account ? c.successSoft : c.sunken }}>
              <T role="micro" style={{ color: account ? c.successText : c.textMuted, fontFamily: fonts.semibold }}>
                {account ? copy.you.member : copy.you.guest}
              </T>
            </View>
            {account ? (
              <T role="micro" color="textMuted" numberOfLines={1}>
                {account.email}
              </T>
            ) : null}
          </View>
        </View>
        <View style={{ gap: 6 }} accessible accessibilityLabel={rank.next ? copy.you.toNext(rank.toNext, copy.ranks[rank.next]) : copy.you.topRank}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: c.sunken, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(rank.fraction * 100)}%`, height: "100%", borderRadius: 5, backgroundColor: c.brand }} />
          </View>
          <T role="micro" color="textMuted">
            {rank.next ? copy.you.toNext(rank.toNext, copy.ranks[rank.next]) : copy.you.topRank}
          </T>
        </View>
      </Card>

      {!account ? <SaveBanner title={copy.you.saveCard.title} /> : null}

      <Card style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
        <View accessibilityRole="list" style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {stats.map((s, i) => (
            <View
              key={s.label}
              accessible
              accessibilityLabel={`${s.label}: ${s.value}`}
              style={{ width: "33.33%", alignItems: "center", gap: 2, paddingVertical: 12, borderTopWidth: i >= 3 ? 1 : 0, borderLeftWidth: i % 3 ? 1 : 0, borderColor: c.line }}
            >
              <Icon name={s.icon} size={18} color={s.tint} />
              <T role="heading">{String(s.value)}</T>
              <T role="micro" color="textMuted" center>
                {s.label}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <T role="heading" header style={{ flex: 1 }}>
            {copy.badges.title}
          </T>
          <Pressable accessibilityRole="button" onPress={() => setSheet("badges")} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <T role="small" color="brandText" style={{ fontFamily: fonts.semibold }}>
              {`${copy.badges.count(earned.length, BADGES.length)} · ${copy.you.seeAll}`}
            </T>
            <Icon name="chevron" size={18} color={c.brandText} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginRight: -16 }}>
          {ordered.slice(0, 8).map((b) => badge(b.id))}
        </ScrollView>
      </View>

      <View style={{ gap: 10 }}>
        <T role="heading" header>
          {copy.you.prefs}
        </T>
        <Card style={{ padding: 6 }}>
          <Row icon="profile" label={copy.you.name} hint={profile.name.trim() || copy.you.noName} chevron onPress={() => (setDraft(profile.name), setNameError(null), setSheet("name"))} />
          <Row icon="clock" label={copy.you.goal} hint={copy.you.goalOption(profile.dailyMinutes)} chevron onPress={() => setSheet("goal")} />
          <Row icon="palette" label={copy.settings.looks} hint={copy.you.looksHint} chevron onPress={() => router.push("/looks")} />
          <Row icon="settings" label={copy.you.settings} chevron onPress={() => router.push("/settings")} />
        </Card>
      </View>

      <Sheet visible={sheet === "name"} onClose={() => setSheet(null)}>
        <T role="heading" header center>
          {copy.you.editName}
        </T>
        <T role="small" color="textMuted" center>
          {copy.you.nameHint}
        </T>
        <View style={{ alignSelf: "stretch" }}>
          <TextField label={copy.you.name} placeholder={copy.auth.namePlaceholder} value={draft} onChangeText={(v) => (setDraft(v), setNameError(null))} error={nameError} maxLength={40} returnKeyType="done" onSubmitEditing={saveName} autoFocus />
        </View>
        <Button title={copy.you.nameSave} onPress={saveName} />
      </Sheet>

      <Sheet visible={sheet === "goal"} onClose={() => setSheet(null)}>
        <T role="heading" header center>
          {copy.you.goal}
        </T>
        <T role="small" color="textMuted" center>
          {copy.you.goalHint}
        </T>
        <View style={{ alignSelf: "stretch" }}>
          <Segmented<DailyMinutes> label={copy.you.goal} value={profile.dailyMinutes} onChange={setGoal} options={[5, 10, 15].map((m) => ({ value: m as DailyMinutes, label: copy.you.goalOption(m) }))} />
        </View>
        <Button title={copy.analysis.close} variant="secondary" onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet visible={sheet === "badges"} onClose={() => setSheet(null)} scroll>
        <T role="heading" header center>
          {`${copy.badges.title} · ${copy.badges.count(earned.length, BADGES.length)}`}
        </T>
        <View accessibilityRole="list" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignSelf: "stretch" }}>
          {ordered.map((b) => badge(b.id, true))}
        </View>
      </Sheet>
    </Page>
  );
}
