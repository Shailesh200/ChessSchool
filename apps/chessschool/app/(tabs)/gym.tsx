import { BOTS } from "@chessschool/chess";
import { botRatingOf, canUseGym, CARD_BACKDROPS, copy, TABS_BACKDROP, type IconName } from "@chessschool/design";
import { router, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { BotAvatar } from "@/components/BotAvatar";
import { GymGuestCard } from "@/components/GymGuestCard";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { ChallengeButton } from "@/components/Growth";
import { Button, Card, Page, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const MODES: { key: "friend" | "shuffle" | "position" | "endgames" | "club"; href: Href; icon: IconName; locked?: boolean }[] = [
  { key: "friend", href: "/play?mode=friend", icon: "club" },
  { key: "shuffle", href: "/play?mode=shuffle", icon: "shuffle" },
  { key: "position", href: "/play?mode=position", icon: "pawn" },
  { key: "endgames", href: "/play?mode=endgame", icon: "trophy" },
  { key: "club", href: "/rooms/club", icon: "lock", locked: true },
];

export default function Gym() {
  const { state } = useApp();
  const { c } = useTheme();
  if (!canUseGym(state.account)) return <GymGuestCard />;
  const bots = state.progress.bots;
  const tile = (key: string, title: string, body: string, icon: IconName, onPress: () => void, locked = false) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={({ pressed }) => ({ flexGrow: 1, flexBasis: "45%", minHeight: 124, gap: 4, padding: 14, borderRadius: 20, borderWidth: 1, borderBottomWidth: 4, borderColor: locked ? c.line : c.brandEdge, backgroundColor: locked ? c.sunken : pressed ? c.sunken : c.card })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
        <Icon name={icon} color={c.brandText} />
      </View>
      <T role="label">{title}</T>
      <T role="small" color="textMuted">
        {body}
      </T>
    </Pressable>
  );

  return (
    <Page title={copy.gym.title} large art={TABS_BACKDROP}>
      <T role="bodyLg" color="textMuted" style={{ marginTop: -8 }}>
        {copy.gym.body}
      </T>
      <Card tone="hero" art={CARD_BACKDROPS.hero} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flex: 1, gap: 8 }}>
          <T role="heading">{state.activeGame ? copy.play.resume : copy.gym.quick}</T>
          <T role="small" color="textMuted">
            {state.activeGame ? copy.play.resumeBody(Math.ceil(state.activeGame.history.length / 2)) : copy.gym.quickBody}
          </T>
          <Button block={false} title={state.activeGame ? copy.play.resume : copy.play.start} icon="play" onPress={() => router.push(state.activeGame ? "/play?resume=1" : "/play?bot=pip&quick=1")} />
        </View>
        <Cody animation="wave" size={104} />
      </Card>
      <ChallengeButton />

      <T role="heading" header>
        {copy.gym.bots}
      </T>
      <View style={{ gap: 10 }}>
        {BOTS.map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`${b.name}. ${b.label}. ${copy.gym.botRating(botRatingOf(state.ratings, b.id, b.rating))}. ${b.blurb}`}
            onPress={() => router.push(`/play?bot=${b.id}`)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: pressed ? c.brand : c.line, backgroundColor: c.card })}
          >
            <BotAvatar bot={b.id} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T role="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {b.name}
                </T>
                <T role="micro" style={{ color: c.goldText, fontFamily: fonts.bold }}>
                  {"★".repeat(b.level)}
                </T>
              </View>
              <T role="micro" color="textMuted" numberOfLines={1}>
                {`${b.label} · ${copy.gym.botRating(botRatingOf(state.ratings, b.id, b.rating))}`}
              </T>
              <T role="small" numberOfLines={2}>
                {b.blurb}
              </T>
              <T role="micro" color="textMuted">
                {copy.gym.record(bots[b.id]?.played ?? 0, bots[b.id]?.won ?? 0)}
              </T>
            </View>
            <Icon name="chevron" size={18} color={c.textMuted} />
          </Pressable>
        ))}
      </View>

      <T role="heading" header>
        {copy.gym.modes}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {MODES.map((m) => tile(m.key, copy.gym[m.key].name, copy.gym[m.key].body, m.icon, () => router.push(m.href), m.locked))}
        {tile("practice", copy.practice.title, copy.rooms.list.practice.promise, "practice", () => router.push("/practice"))}
        {tile("vision", copy.vision.title, copy.vision.tile, "eye", () => router.push("/vision"))}
        {tile("analysis", copy.analysisBoard.title, copy.analysisBoard.body, "bulb", () => router.push("/analysis"))}
      </View>
    </Page>
  );
}
