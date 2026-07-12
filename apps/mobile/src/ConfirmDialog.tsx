import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, font, radius, shadowCard, space, type } from "./theme";

/** In-house confirm modal — replaces Alert.alert for resign/draw flows. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button label={cancelLabel} variant="outline" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                variant={tone === "danger" ? "danger" : "primary"}
                onPress={onConfirm}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28,27,46,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: space[6],
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space[5],
    ...shadowCard,
  },
  title: { ...type.lg, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  message: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2], textAlign: "center" },
  actions: { flexDirection: "row", gap: space[2], marginTop: space[4], justifyContent: "center" },
});
