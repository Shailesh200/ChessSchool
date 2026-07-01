import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "./auth";
import { useProgress } from "./progressStore";
import { Icon } from "./Icon";
import { colors, font, radius, space, type } from "./theme";

// Mirrors web's levelForXp / xpProgress (progression.store.ts).
function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return { level, into: xp - acc, need };
}

export function TopBar() {
  const router = useRouter();
  const { guest, exitGuest } = useAuth();
  const d = useProgress();
  const xp = (d?.xp as number) ?? 0;
  const streak = (d?.streak as number) ?? 0;
  const graduated = ((d?.graduatedClasses as string[]) ?? []).length;
  const { level, into, need } = levelInfo(xp);
  const pct = need > 0 ? into / need : 0;

  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct, w]);

  if (guest) {
    return (
      <View style={styles.bar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandMark}>♟</Text>
          <Text style={styles.brandText}>ChessSchool</Text>
        </View>
        <Pressable
          style={styles.enroll}
          onPress={() => {
            exitGuest();
            router.push("/login");
          }}
        >
          <Text style={styles.enrollText}>Enroll</Text>
          <Icon name="chevronRight" size={14} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Icon name="flame" size={20} color={colors.accent} />
        <Text style={styles.num}>{streak}</Text>
      </View>
      <View style={styles.mid}>
        <View style={styles.lpill}>
          <Text style={styles.ltext}>L{level}</Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: w.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
        </View>
      </View>
      <View style={styles.gpill}>
        <Icon name="cap" size={16} color={colors.gold} />
        <Text style={styles.num}>{graduated}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: colors.hairline, backgroundColor: colors.surface },
  side: { flexDirection: "row", alignItems: "center", gap: 6 },
  num: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  mid: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[2] },
  lpill: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  ltext: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.brand },
  gpill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(246,195,67,0.15)", borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  brandMark: { fontSize: 22, color: colors.brand },
  brandText: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  enroll: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: space[3], paddingVertical: 7 },
  enrollText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
});
