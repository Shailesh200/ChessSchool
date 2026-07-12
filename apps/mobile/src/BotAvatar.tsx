import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { botAvatarIdForElo } from "@chess-school/core";
import { mobileBotProfile } from "./bots";

/** Gradient tile + emoji portrait for bot opponents. */
export function BotAvatar({ elo, size = 44 }: { elo: number; size?: number }) {
  const bot = mobileBotProfile(elo);
  const fontSize = Math.round(size * 0.46);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderColor: bot.tone.ring, borderRadius: size * 0.28 }]}>
      <LinearGradient
        colors={[bot.tone.from, bot.tone.to]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: size * 0.26 }]}
      />
      <Text style={{ fontSize }}>{bot.emoji}</Text>
    </View>
  );
}

/** Portrait by avatar id (for settings / future use). */
export function BotAvatarById({ avatarId, size = 44 }: { avatarId: string; size?: number }) {
  const elo =
    avatarId === "bot-pip" ? 400 :
    avatarId === "bot-cody" ? 650 :
    avatarId === "bot-remi" ? 950 :
    avatarId === "bot-sasha" ? 1300 :
    avatarId === "bot-vera" ? 1750 :
    avatarId === "bot-magnus" ? 2100 :
    2500;
  return <BotAvatar elo={elo} size={size} />;
}

export function botAvatarId(elo: number): string {
  return botAvatarIdForElo(elo);
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
