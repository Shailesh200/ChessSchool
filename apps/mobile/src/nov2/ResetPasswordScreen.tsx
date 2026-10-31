import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/Icon";
import { useSettings } from "@/settings";
import { isPremiumLook } from "@/nov2/uiLook";
import { DexButton } from "@/nov2/DexButton";
import { FieldAlert, PasswordStrengthBlock, PremiumPasswordField } from "@/nov2/PremiumPasswordField";
import { PremiumAuthShell, SentBox } from "@/nov2/PremiumAuthShell";
import {
  checkPasswordStrength,
  passwordsMatch,
  submitPasswordReset,
} from "@/nov2/passwordReset";
import { premiumColors, premiumFont, premiumSpace, premiumType } from "@/nov2/premiumTokens";

type Phase = "form" | "success" | "expired";

export function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? "";
  const emailHint = (Array.isArray(params.email) ? params.email[0] : params.email)?.trim() ?? "";
  const { uiLook } = useSettings();
  const premium = isPremiumLook({ uiLook });

  const [phase, setPhase] = useState<Phase>(() => (token ? "form" : "expired"));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmHelp, setConfirmHelp] = useState<string | null>(null);

  const check = useMemo(() => checkPasswordStrength(password, emailHint), [password, emailHint]);
  const formHasError = submitAttempted && (!check.minOk || !passwordsMatch(password, confirm));
  const coachMood =
    check.level >= 4 ? "happy" : formHasError ? "encouraging" : phase === "form" ? "thinking" : "neutral";
  const coachLine =
    phase === "success"
      ? "Password changed. Welcome back!"
      : phase === "expired"
        ? "This link timed out. Let me send a new one."
        : check.level >= 4
          ? "Nicely done. That one is strong."
          : formHasError
            ? "Close. Make both boxes match and try again."
            : "Pick something you will remember. Longer is stronger.";

  async function save() {
    setSubmitAttempted(true);
    if (!check.minOk) return;
    if (!passwordsMatch(password, confirm)) {
      setConfirmHelp("These two do not match. Type the same password in both boxes.");
      return;
    }
    setConfirmHelp(null);
    setBusy(true);
    try {
      const result = await submitPasswordReset(token, password);
      if (!result.ok) {
        if (result.reason === "expired") setPhase("expired");
        else setConfirmHelp(result.message ?? "Could not save password. Try again.");
        return;
      }
      setPhase("success");
    } finally {
      setBusy(false);
    }
  }

  if (!premium) {
    return (
      <PremiumAuthShell coachLine="Choose a new password." testID="reset-password-classic">
        <PremiumPasswordField label="New password" value={password} onChangeText={setPassword} />
        <PremiumPasswordField label="Confirm" value={confirm} onChangeText={setConfirm} />
        <DexButton label="Save" onPress={() => void save()} loading={busy} />
      </PremiumAuthShell>
    );
  }

  if (phase === "expired") {
    return (
      <PremiumAuthShell coachLine={coachLine} coachMood="encouraging" testID="reset-password-expired">
        <Text style={styles.h1}>That link has expired</Text>
        <Text style={styles.muted}>Reset links only work for 30 minutes, and only once.</Text>
        <View style={styles.alertWarn} accessibilityRole="alert">
          <Icon name="warning" size={22} color={premiumColors.warningText} duotone />
          <Text style={styles.alertWarnText}>Ask for a fresh link and we will send it right away.</Text>
        </View>
        <DexButton label="Send me a new link" onPress={() => router.replace("/forgot-password")} />
        <Pressable onPress={() => router.replace("/login")} style={styles.foot}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </PremiumAuthShell>
    );
  }

  if (phase === "success") {
    return (
      <PremiumAuthShell coachLine={coachLine} coachMood="happy" testID="reset-password-success">
        <Text style={styles.h1}>Password changed</Text>
        <SentBox icon={<Icon name="check" size={28} color={premiumColors.brand} duotone />}>
          <Text style={styles.sentMain}>
            You are all set. You were signed out on other devices to keep your account safe.
          </Text>
        </SentBox>
        <DexButton label="Continue to Learn" onPress={() => router.replace("/(tabs)/academy")} />
        {!!emailHint && <Text style={[styles.help, styles.center]}>Signed in as {emailHint}</Text>}
      </PremiumAuthShell>
    );
  }

  const showPwError = submitAttempted && !check.minOk;
  const showConfirmError = submitAttempted && (!passwordsMatch(password, confirm) || confirmHelp);

  return (
    <PremiumAuthShell coachLine={coachLine} coachMood={coachMood} testID="reset-password">
      <Text style={styles.h1}>Choose a new password</Text>
      <Text style={styles.muted}>Pick something you will remember. You will sign in with it next time.</Text>

      <PremiumPasswordField
        label="New password"
        value={password}
        onChangeText={setPassword}
        invalid={showPwError}
        testID="reset-new-password"
      />
      {showPwError && !check.rules.length ? <FieldAlert message="Use at least 8 characters." /> : null}
      <PasswordStrengthBlock check={check} showRules />

      <PremiumPasswordField
        label="Confirm new password"
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          setConfirmHelp(null);
        }}
        invalid={!!showConfirmError}
        testID="reset-confirm-password"
      />
      {showConfirmError ? (
        <FieldAlert
          message={confirmHelp ?? "These two do not match. Type the same password in both boxes."}
        />
      ) : null}
      {!showConfirmError && passwordsMatch(password, confirm) && confirm.length > 0 ? (
        <Text style={styles.help}>Matches.</Text>
      ) : null}

      <DexButton label="Save new password" onPress={() => void save()} loading={busy} />

      <Pressable onPress={() => router.replace("/login")} style={styles.foot}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </PremiumAuthShell>
  );
}

const styles = StyleSheet.create({
  h1: { ...premiumType.h1, fontFamily: premiumFont.display, color: premiumColors.text },
  muted: { ...premiumType.body, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
  help: { fontSize: 13, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
  center: { textAlign: "center" },
  sentMain: { ...premiumType.body, fontFamily: premiumFont.ui, color: premiumColors.text, textAlign: "center" },
  foot: { alignItems: "center", marginTop: premiumSpace[2] },
  link: { color: premiumColors.textLink, fontFamily: premiumFont.uiBold, fontSize: 16, textDecorationLine: "underline" },
  alertWarn: {
    flexDirection: "row",
    gap: premiumSpace[3],
    alignItems: "flex-start",
    backgroundColor: premiumColors.warningSoft,
    borderRadius: 16,
    padding: premiumSpace[4],
  },
  alertWarnText: { flex: 1, color: premiumColors.warningText, fontFamily: premiumFont.uiBold, fontSize: 15 },
});
