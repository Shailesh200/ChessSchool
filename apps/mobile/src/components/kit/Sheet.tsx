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
  /** Status sheets center the illustration, title, and actions. */
  align?: "start" | "center";
};

/** `.sheet` bottom panel from kit/components.css */
export function KitSheet({ open, onClose, title, children, align = "start" }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const centered = align === "center";

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlayScrim }]}
          onPress={onClose}
          accessibilityLabel="Close sheet"
        />
        <View
          style={[
            styles.panel,
            shadowStyle("sheet"),
            {
              paddingBottom: Math.max(insets.bottom, space["6"]),
              backgroundColor: colors.surfaceCard,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingHorizontal: space["5"],
              paddingTop: space["2.5"],
              alignItems: centered ? "center" : "stretch",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          {title ? (
            <Text
              style={{
                fontFamily: font.displayBold,
                color: colors.ink,
                fontSize: type.h3.fontSize,
                lineHeight: type.h3.lineHeight,
                textAlign: centered ? "center" : "left",
                alignSelf: "stretch",
              }}
            >
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  panel: {
    maxHeight: "85%",
    gap: 14,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 99 },
});
