import { BOTS } from "@chessschool/chess";
import { copy, type IconName } from "@chessschool/design";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { BotAvatar } from "@/components/BotAvatar";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, Page, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const MODES: { key: "friend" | "shuffle" | "position" | "review" | "club"; href: Href; icon: IconName; locked?: boolean }[] = [
  { key: "friend", href: "/play?mode=friend", icon: "club" },
  { key: "shuffle", href: "/play?mode=shuffle", icon: "shuffle" },
  { key: "position", href: "/play?mode=position", icon: "pawn" },
  { key: "review", href: "/review", icon: "history" },
  { key: "club", href: "/rooms/club", icon: "lock", locked: true },
];

export default function Gym() {
  const { state } = useApp();
  const { c } = useTheme();
  const bots = state.progress.bots;
  const tile = (key: string, title: string, body: string, icon: IconName, onPress: () => void, locked = false) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={({ pressed }) => ({ flexGrow: 1, flexBasis: "45%", minHeight: 112, gap: 4, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: locked ? c.sunken : pressed ? c.sunken : c.card })}>
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
    <Page title={copy.gym.title} large>
      <T role="bodyLg" color="textMuted" style={{ marginTop: -8 }}>
        {copy.gym.body}
      </T>
      <Card tone="hero" style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flex: 1, gap: 8 }}>
          <T role="heading">{state.activeGame ? copy.play.resume : copy.gym.quick}</T>
          <T role="small" color="textMuted">
            {state.activeGame ? copy.play.resumeBody(Math.ceil(state.activeGame.history.length / 2)) : copy.gym.quickBody}
          </T>
          <Button block={false} title={state.activeGame ? copy.play.resume : copy.play.start} icon="play" onPress={() => router.push(state.activeGame ? "/play?resume=1" : "/play?bot=cody&quick=1")} />
        </View>
        <Cody animation="wave" size={104} />
      </Card>

      <T role="heading" header>
        {copy.gym.bots}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
        {BOTS.map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`${b.name}. ${b.strength}. ${b.blurb}`}
            onPress={() => router.push(`/play?bot=${b.id}`)}
            style={({ pressed }) => ({ width: 132, alignItems: "center", gap: 4, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1, borderColor: pressed ? c.brand : c.line, backgroundColor: c.card })}
          >
            <BotAvatar bot={b.id} size={56} />
            <T role="label" center numberOfLines={1}>
              {b.name}
            </T>
            <T role="micro" style={{ color: c.goldText, fontFamily: fonts.bold }}>
              {"★".repeat(b.level)}
            </T>
            <T role="micro" color="textMuted" center>
              {b.strength}
            </T>
            <T role="micro" color="textMuted">
              {copy.gym.record(bots[b.id]?.played ?? 0, bots[b.id]?.won ?? 0)}
            </T>
          </Pressable>
        ))}
      </ScrollView>

      <T role="heading" header>
        {copy.gym.modes}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {MODES.map((m) => tile(m.key, copy.gym[m.key].name, copy.gym[m.key].body, m.icon, () => router.push(m.href), m.locked))}
        {tile("practice", copy.practice.title, copy.rooms.list.practice.promise, "practice", () => router.push("/practice"))}
      </View>
    </Page>
  );
}
