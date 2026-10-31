import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, useColorScheme } from "react-native";
import { Icon } from "@/Icon";
import { usePremiumKitTheme } from "@/components/kit";
import { useSettings } from "@/settings";
import { resolvePremiumColorMode } from "@/themeMode";
import { createPasswordFieldStyles } from "./boaKitStyles";
import type { PasswordCheck, PasswordRuleId } from "./passwordReset";

const RULE_LABELS: Record<PasswordRuleId, string> = {
  length: "At least 8 characters",
  symbol: "A number or a symbol",
  notEmail: "Not your email",
};

export function PremiumPasswordField({
  label,
  value,
  onChangeText,
  invalid,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  invalid?: boolean;
  testID?: string;
}) {
  const kit = usePremiumKitTheme();
  const { themeMode } = useSettings();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createPasswordFieldStyles(kit, mode), [kit, mode]);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inpRow}>
        <TextInput
          testID={testID}
          style={[styles.input, invalid && styles.inputBad]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={kit.colors.ink300}
        />
        <Pressable
          style={styles.eye}
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={20} color={kit.colors.ink500} />
        </Pressable>
      </View>
    </View>
  );
}

export function PasswordStrengthBlock({ check, showRules = true }: { check: PasswordCheck; showRules?: boolean }) {
  const kit = usePremiumKitTheme();
  const { themeMode } = useSettings();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createPasswordFieldStyles(kit, mode), [kit, mode]);

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.pwm} accessibilityRole="adjustable" accessibilityLabel="Password strength">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              i < check.level && check.level === 1 && styles.l1,
              i < check.level && check.level === 2 && styles.l2,
              i < check.level && check.level >= 3 && styles.l3,
            ]}
          />
        ))}
      </View>
      <Text style={styles.pwmT}>{check.label}</Text>
      {showRules && (
        <View accessibilityLabel="Password rules">
          {(Object.keys(RULE_LABELS) as PasswordRuleId[]).map((id) => {
            const ok = check.rules[id];
            return (
              <View key={id} style={styles.rule}>
                {ok ? <Icon name="check" size={14} color={kit.colors.success} /> : <View style={styles.ruleDot} />}
                <Text style={[styles.ruleText, ok && styles.ruleOk]}>{RULE_LABELS[id]}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function FieldAlert({ message }: { message: string }) {
  const kit = usePremiumKitTheme();
  const { themeMode } = useSettings();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createPasswordFieldStyles(kit, mode), [kit, mode]);

  return (
    <View style={styles.msg} accessibilityRole="alert">
      <Icon name="close" size={16} color={styles.msgText.color} />
      <Text style={styles.msgText}>{message}</Text>
    </View>
  );
}
