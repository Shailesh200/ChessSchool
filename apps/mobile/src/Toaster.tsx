import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toastStore, type ToastItem } from "./toast";
import { colors, font, radius, shadowCard, space, type } from "./theme";

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const toneColor =
    item.tone === "success" ? colors.success : item.tone === "danger" ? colors.danger : colors.brand;
  return (
    <Pressable onPress={onDismiss} style={styles.card}>
      <View style={[styles.dot, { backgroundColor: toneColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.message}>{item.message}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Toaster() {
  const insets = useSafeAreaInsets();
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.get, toastStore.get);

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + space[2] }]}>
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => toastStore.dismiss(t.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...shadowCard,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  message: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  description: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
});
