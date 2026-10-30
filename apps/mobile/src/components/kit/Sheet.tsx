import { type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremiumKitTheme } from "./kitThemeContext";
import { shadowStyle } from "@/theme/premium/mapTokens";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** `.sheet` bottom panel from kit/components.css */
export function KitSheet({ open, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, radius, space, font, type } = usePremiumKitTheme();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlayScrim }]}
        onPress={onClose}
        accessibilityLabel="Close sheet"
      />
      <View
        style={[
          styles.panel,
          shadowStyle("elev-3"),
          {
            paddingBottom: Math.max(insets.bottom, space["4"]),
            backgroundColor: colors.surfaceCard,
            borderColor: colors.hairline,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space["5"],
            paddingTop: space["3"],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.ink300 }]} />
        {title ? (
          <Text
            style={{
              fontFamily: font.displayBold,
              color: colors.ink,
              fontSize: type.lg.fontSize,
              lineHeight: type.lg.lineHeight,
              marginBottom: space["3"],
            }}
          >
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  panel: {
    borderWidth: 1,
    maxHeight: "85%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
});
