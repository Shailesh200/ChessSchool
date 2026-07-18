import { type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "./ThemeProvider";
import { useType } from "./typography";
import { font, radius, shadowElev3, space } from "./theme";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Generic bottom sheet — web Sheet.tsx parity for mobile. */
export function Sheet({ open, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const type = useType();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close sheet" />
      <View
        style={[
          styles.panel,
          {
            paddingBottom: Math.max(insets.bottom, space[4]),
            backgroundColor: colors.surfaceCard,
            borderColor: colors.hairline,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.ink300 }]} />
        {title ? (
          <Text style={[styles.title, { color: colors.ink, fontSize: type.lg.fontSize, lineHeight: type.lg.lineHeight }]}>
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,27,46,0.45)" },
  panel: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    maxHeight: "85%",
    ...shadowElev3,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: space[3] },
  title: { fontFamily: font.bold, marginBottom: space[3] },
});
