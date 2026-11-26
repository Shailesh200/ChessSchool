import { BADGES, CARD_BACKDROPS, TABS_BACKDROP, FLAIRS, isUnitBadge, weekCard, cleanName, copy, errorMessage, nameProblem, dayKey, earnedBadges, focusCourse, ideasLearned, rankFor, visibleStreak, type AvatarId, type DailyMinutes, type FlairId } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AvatarFace, AvatarPicker } from "@/components/AvatarFace";
import { Icon } from "@/components/Icon";
import { InviteCard, ShareCardButton } from "@/components/Growth";
import { useMyDetails } from "@/components/Social";
import { RatingChart } from "@/components/RatingChart";
import { SkillsCard } from "@/components/SkillsCard";
import { Button, Card, IconButton, Page, Row, SaveBanner, Segmented, Sheet, T, TextField, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { RankEmblem } from "@/components/RankEmblem";

export default function You() {
  const { state, setProfile, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "name" | "goal" | "picture">(null);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<TextInput>(null);
  useEffect(() => {
    if (sheet !== "name") return;
    const t = setTimeout(() => nameRef.current?.focus(), 420);
    return () => clearTimeout(t);
  }, [sheet]);
  const { profile, progress, account } = state;
  const { mine } = useMyDetails();
  const rank = rankFor(progress.xp);
  const earned = earnedBadges(progress, state.ratings);
  const saveLook = (patch: { avatar?: AvatarId; flair?: FlairId | null }) => {
    setProfile(patch);
    cue("tap");
    if (account) api.updateMe(patch).catch(() => {});
  };
  // Signed in, name and picture live in Edit profile; guests edit them in sheets here.
  const editName = () => (account ? router.push("/profile-edit") : (setDraft(profile.name), setNameError(null), setSheet("name")));
  const editPicture = () => (account ? router.push("/profile-edit") : setSheet("picture"));
  const course = useCourse();
  // Certificates come from the server, so only signed-in learners have them.
  const finishedUnits = account && course ? focusCourse(course, progress.completed).unitsDone : [];

  const saveName = async () => {
    const clean = cleanName(draft);
    if (!clean) {
      setNameError(copy.auth.errors.nameRequired);
      return cue("gentle-no");
    }
    // Reserved names are left to the server: staff accounts may use them.
    const problem = nameProblem(draft);
    if (problem && problem !== "reserved") {
      setNameError(copy.social.nameProblems[problem]);
      return cue("gentle-no");
    }
    if (account) {
      try {
        await api.updateMe({ name: clean });
      } catch (err) {
        if ((err as { code?: string }).code === "name_not_allowed") {
          setNameError(errorMessage(err));
          return cue("gentle-no");
        }
      }
    }
    setProfile({ name: clean });
    setSheet(null);
    cue("success");
    toast(copy.you.nameSaved(clean));
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

  return (
    <Page title={copy.you.title} large art={TABS_BACKDROP} action={<IconButton icon="settings" label={copy.you.settings} onPress={() => router.push("/settings")} />}>
      <Card tone="hero" art={CARD_BACKDROPS.hero} style={[{ gap: 16, borderWidth: 1, borderColor: c.line }, mine?.details.banner ? { borderTopWidth: 6, borderTopColor: c[mine.details.banner] } : null]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={account ? copy.profileEdit.open : copy.you.avatar} onPress={editPicture} style={{ padding: 3, borderRadius: 999, borderWidth: 2, borderColor: c.brand }}>
            <AvatarFace id={profile.avatar} photo={mine?.photo} size={84} country={profile.country ?? null} />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${profile.name.trim() || copy.you.noName}. ${copy.you.editName}`} onPress={editName} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T role="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                {profile.name.trim() || copy.you.noName}
              </T>
              <Icon name="edit" size={16} color={c.textMuted} />
            </Pressable>
            {account?.username ? (
              <T role="label" color="brandText" numberOfLines={1}>
                {copy.social.at(account.username)}
              </T>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, minHeight: 26, borderRadius: 13, backgroundColor: c.goldSoft }}>
                <RankEmblem rank={rank.rank} size={22} />
                <T role="micro" style={{ color: c.goldText, fontFamily: fonts.semibold }}>
                  {profile.flair && profile.flair !== "monitor" ? copy.you.flairs[profile.flair] : copy.today.level(copy.ranks[rank.rank], rank.level)}
                </T>
              </View>
              <View style={{ paddingHorizontal: 10, minHeight: 26, borderRadius: 13, justifyContent: "center", backgroundColor: account ? c.successSoft : c.sunken }}>
                <T role="micro" style={{ color: account ? c.successText : c.textMuted, fontFamily: fonts.semibold }}>
                  {account ? copy.you.member : copy.you.guest}
                </T>
              </View>
            </View>
          </View>
        </View>
        <View style={{ gap: 6 }} accessible accessibilityLabel={`${progress.xp} XP. ${rank.next ? copy.you.toNext(rank.toNext, copy.ranks[rank.next]) : copy.you.topRank}`}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <T role="heading">{`${progress.xp} XP`}</T>
            <T role="micro" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {rank.next ? copy.you.toNext(rank.toNext, copy.ranks[rank.next]) : copy.you.topRank}
            </T>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: c.sunken, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(rank.fraction * 100)}%`, height: "100%", borderRadius: 5, backgroundColor: c.brand }} />
          </View>
        </View>
        {account ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title={copy.profileEdit.open} icon="edit" variant="secondary" onPress={() => router.push("/profile-edit")} style={{ flex: 1 }} />
            <Button title={copy.social.friendsTitle} icon="profile" variant="secondary" onPress={() => router.push("/friends")} style={{ flex: 1 }} />
          </View>
        ) : null}
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

      <RatingChart />

      <SkillsCard skills={progress.skills} />

      {account ? <ShareCardButton kind="weekly" data={weekCard(progress, new Date())} label={copy.share.weeklyAction} /> : null}

      <InviteCard />

      <Pressable accessibilityRole="button" accessibilityLabel={copy.trophies.open} onPress={() => router.push("/trophies")}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T role="eyebrow" color="textMuted" header>
              {copy.trophies.title}
            </T>
            <Icon name="chevron" size={20} color={c.brandText} />
          </View>
          <T role="small" color="textMuted">
            {copy.trophies.summary(earned.filter((id) => !isUnitBadge(id)).length, BADGES.filter((b) => !isUnitBadge(b.id)).length, finishedUnits.length)}
          </T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {earned.filter((id) => !isUnitBadge(id)).slice(-5).reverse().map((id) => (
              <View key={id} style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.goldSoft, borderWidth: 1, borderColor: c.gold }}>
                <Icon name="trophy" size={20} color={c.goldText} />
              </View>
            ))}
            {finishedUnits.length ? (
              <View style={{ height: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.brandSoft }}>
                <Icon name="doc" size={18} color={c.brandText} />
                <T role="small" style={{ color: c.brandText, fontFamily: fonts.bold }}>{String(finishedUnits.length)}</T>
              </View>
            ) : null}
          </View>
        </Card>
      </Pressable>

      <View style={{ gap: 10 }}>
        <T role="heading" header>
          {copy.you.prefs}
        </T>
        <Card style={{ padding: 6 }}>
          {account ? <Row icon="edit" label={copy.profileEdit.open} hint={copy.profileEdit.openHint} chevron onPress={() => router.push("/profile-edit")} /> : null}
          {account ? <Row icon="profile" label={copy.social.friendsTitle} hint={copy.social.friendsHint} chevron onPress={() => router.push("/friends")} /> : null}
          {/* Guests have no Edit profile, so name and picture stay here for them. */}
          {!account ? <Row icon="profile" label={copy.you.name} hint={profile.name.trim() || copy.you.noName} chevron onPress={editName} /> : null}
          <Row icon="clock" label={copy.you.goal} hint={copy.you.goalOption(profile.dailyMinutes)} chevron onPress={() => setSheet("goal")} />
          {!account ? <Row icon="profile" label={copy.you.avatar} hint={copy.you.avatarHint} chevron onPress={editPicture} /> : null}
          <Row icon="palette" label={copy.settings.looks} hint={copy.you.looksHint} chevron onPress={() => router.push("/looks")} />
          <Row icon="trophy" label={copy.board.open} hint={copy.board.global} chevron onPress={() => router.push("/leaderboard")} />
          <Row icon="history" label={copy.you.review} hint={copy.gym.review.body} chevron onPress={() => router.push("/review")} />
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
          <TextField ref={nameRef} label={copy.you.name} placeholder={copy.auth.namePlaceholder} value={draft} onChangeText={(v) => (setDraft(v), setNameError(null))} error={nameError} maxLength={40} returnKeyType="done" onSubmitEditing={saveName} />
        </View>
        <Button title={copy.you.nameSave} onPress={saveName} />
      </Sheet>

      <Sheet visible={sheet === "picture"} onClose={() => setSheet(null)} scroll>
        <T role="heading" header center>
          {copy.you.avatar}
        </T>
        <T role="small" color="textMuted" center>
          {copy.you.avatarHint}
        </T>
        <AvatarPicker value={profile.avatar} onChange={(id) => saveLook({ avatar: id })} />
        <T role="label" center>
          {copy.you.flair}
        </T>
        <View style={{ alignSelf: "stretch", gap: 8 }}>
          {FLAIRS.filter((id) => id !== "monitor").map((id) => (
            <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: profile.flair === id }} onPress={() => saveLook({ flair: profile.flair === id ? null : id })} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: profile.flair === id ? c.brand : c.line, backgroundColor: c.card }}>
              <T role="label">{copy.you.flairs[id]}</T>
            </Pressable>
          ))}
        </View>
        <Button title={copy.analysis.close} variant="secondary" onPress={() => setSheet(null)} />
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

    </Page>
  );
}
