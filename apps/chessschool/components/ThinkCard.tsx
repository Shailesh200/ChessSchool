import { THINK_PATH, copy } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { Icon } from "./Icon";
import { Button, Card, T } from "./ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** Entry to the "Think like a player" track (Learn and Gym). */
export function ThinkCard() {
  const { state } = useApp();
  const { c } = useTheme();
  const done = THINK_PATH.filter((n) => state.progress.completed[n.id]).length;
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="bulb" color={c.brandText} />
        <T role="heading" header style={{ flex: 1 }}>
          {copy.think.title}
        </T>
      </View>
      <T role="small" color="textMuted">
        {copy.think.sub} · {copy.think.progress(done, THINK_PATH.length)}
      </T>
      <Button title={copy.think.open} icon="arrowRight" variant="secondary" onPress={() => router.push("/think")} />
    </Card>
  );
}
