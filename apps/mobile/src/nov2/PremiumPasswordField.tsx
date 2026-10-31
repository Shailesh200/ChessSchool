import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/Icon";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "./premiumTokens";
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
          placeholderTextColor={premiumColors.textSubtle}
        />
        <Pressable
          style={styles.eye}
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={20} color={premiumColors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export function PasswordStrengthBlock({ check, showRules = true }: { check: PasswordCheck; showRules?: boolean }) {
  const stylesLocal = useMemo(() => meterStyles, []);
  return (
    <View style={{ gap: 6 }}>
      <View style={stylesLocal.pwm} accessibilityRole="adjustable" accessibilityLabel="Password strength">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              stylesLocal.bar,
              i < check.level && check.level === 1 && stylesLocal.l1,
              i < check.level && check.level === 2 && stylesLocal.l2,
              i < check.level && check.level >= 3 && stylesLocal.l3,
            ]}
          />
        ))}
      </View>
      <Text style={stylesLocal.pwmT}>{check.label}</Text>
      {showRules && (
        <View accessibilityLabel="Password rules">
          {(Object.keys(RULE_LABELS) as PasswordRuleId[]).map((id) => {
            const ok = check.rules[id];
            return (
              <View key={id} style={stylesLocal.rule}>
                {ok ? (
                  <Icon name="check" size={14} color={premiumColors.success} />
                ) : (
                  <View style={stylesLocal.ruleDot} />
                )}
                <Text style={[stylesLocal.ruleText, ok && stylesLocal.ruleOk]}>{RULE_LABELS[id]}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function FieldAlert({ message }: { message: string }) {
  return (
    <View style={alertStyles.msg} accessibilityRole="alert">
      <Icon name="close" size={16} color={premiumColors.errorText} />
      <Text style={alertStyles.msgText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...premiumType.body, fontFamily: premiumFont.uiBold, color: premiumColors.text },
  inpRow: { position: "relative" },
  input: {
    minHeight: 56,
    borderRadius: premiumRadius.lg,
    borderWidth: 1.5,
    borderColor: premiumColors.lineStrong,
    backgroundColor: premiumColors.surface,
    paddingHorizontal: premiumSpace[4],
    paddingRight: 48,
    fontSize: 16,
    fontFamily: premiumFont.ui,
    color: premiumColors.text,
  },
  inputBad: { borderColor: premiumColors.error, borderWidth: 2 },
  eye: { position: "absolute", right: 8, top: 8, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});

const meterStyles = StyleSheet.create({
  pwm: { flexDirection: "row", gap: 4, marginTop: 4 },
  bar: { flex: 1, height: 8, borderRadius: 99, backgroundColor: premiumColors.line },
  l1: { backgroundColor: premiumColors.error },
  l2: { backgroundColor: premiumColors.xp },
  l3: { backgroundColor: premiumColors.success },
  pwmT: { fontSize: 13, fontFamily: premiumFont.uiBold, color: premiumColors.textMuted },
  rule: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  ruleDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: premiumColors.textMuted },
  ruleText: { fontSize: 13, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
  ruleOk: { color: premiumColors.successText, fontFamily: premiumFont.uiBold },
});

const alertStyles = StyleSheet.create({
  msg: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: premiumColors.errorSoft,
    borderRadius: premiumRadius.sm,
    padding: premiumSpace[2],
  },
  msgText: { flex: 1, color: premiumColors.errorText, fontFamily: premiumFont.uiBold, fontSize: 14 },
});
