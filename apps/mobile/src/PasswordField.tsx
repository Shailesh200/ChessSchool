import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Icon } from "@/Icon";
import { useAppTheme } from "@/ThemeProvider";
import { buttonHeight, font, radius, space } from "@/theme";

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  containerStyle?: object;
};

/** Password input with show/hide toggle. */
export function PasswordField({ containerStyle, style, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const { colors } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { position: "relative", marginBottom: 12 },
        input: {
          height: buttonHeight.md,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: colors.hairline,
          backgroundColor: colors.surfaceCard,
          paddingHorizontal: space[5],
          paddingRight: 48,
          fontSize: 16,
          fontFamily: font.medium,
          color: colors.ink,
        },
        eye: {
          position: "absolute",
          right: space[4],
          top: 0,
          bottom: 0,
          justifyContent: "center",
        },
      }),
    [colors],
  );

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput {...rest} style={[styles.input, style]} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} color={colors.ink500} />
      </Pressable>
    </View>
  );
}
