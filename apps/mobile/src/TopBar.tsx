import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
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
  const [d, setD] = useState({ xp: 0, streak: 0, graduated: 0 });

  useFocusEffect(
    useCallback(() => {
      api<{ xp: number; streak: number; graduatedClasses: string[] }>("/api/progress")
        .then((p) => setD({ xp: p.xp ?? 0, streak: p.streak ?? 0, graduated: (p.graduatedClasses ?? []).length }))
        .catch(() => void 0);
    }, []),
  );

  const { level, into, need } = levelInfo(d.xp);
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Icon name="flame" size={20} color={colors.accent} />
        <Text style={styles.num}>{d.streak}</Text>
      </View>
      <View style={styles.mid}>
        <View style={styles.lpill}>
          <Text style={styles.ltext}>L{level}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(into / need) * 100}%` }]} />
        </View>
      </View>
      <View style={styles.gpill}>
        <Icon name="cap" size={16} color={colors.gold} />
        <Text style={styles.num}>{d.graduated}</Text>
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
});
