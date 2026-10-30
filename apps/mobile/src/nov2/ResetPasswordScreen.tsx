import { useMemo, useState } from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/Icon";
import { useSettings } from "@/settings";
import { isPremiumLook } from "@/nov2/uiLook";
import { KitButton, usePremiumKitTheme } from "@/components/kit";
import { FieldAlert, PasswordStrengthBlock, PremiumPasswordField } from "@/nov2/PremiumPasswordField";
import { PremiumAuthShell, SentBox } from "@/nov2/PremiumAuthShell";
import { createPremiumAuthStyles } from "@/nov2/premiumKitStyles";
import { resolvePremiumColorMode } from "@/themeMode";
import { checkPasswordStrength, passwordsMatch, submitPasswordReset } from "@/nov2/passwordReset";

type Phase = "form" | "success" | "expired";

function capturePhase(raw: string | undefined): Phase | null {
  if (process.env.EXPO_PUBLIC_BOA_CAPTURE !== "1" || !raw) return null;
  if (raw === "success" || raw === "expired" || raw === "form" || raw === "error" || raw === "strong") {
    if (raw === "success") return "success";
    if (raw === "expired") return "expired";
    return "form";
  }
  return null;
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string; phase?: string }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? "capture-token";
  const emailHint = (Array.isArray(params.email) ? params.email[0] : params.email)?.trim() ?? "student@example.com";
  const { uiKit, themeMode } = useSettings();
  const premium = isPremiumLook({ uiKit });
  const kit = usePremiumKitTheme();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createPremiumAuthStyles(kit, mode), [kit, mode]);

  const forced = capturePhase(typeof params.phase === "string" ? params.phase : undefined);
  const [phase, setPhase] = useState<Phase>(() => forced ?? (token ? "form" : "expired"));
  const [password, setPassword] = useState(
    process.env.EXPO_PUBLIC_BOA_CAPTURE === "1" && params.phase === "strong" ? "Riverdale!9" : "",
  );
  const [confirm, setConfirm] = useState(
    process.env.EXPO_PUBLIC_BOA_CAPTURE === "1" && params.phase === "strong" ? "Riverdale!9" : "",
  );
  const [submitAttempted, setSubmitAttempted] = useState(
    process.env.EXPO_PUBLIC_BOA_CAPTURE === "1" && params.phase === "error",
  );
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
        <KitButton label="Save" onPress={() => void save()} loading={busy} />
      </PremiumAuthShell>
    );
  }

  if (phase === "expired") {
    return (
      <PremiumAuthShell coachLine={coachLine} coachMood="encouraging" testID="reset-password-expired">
        <Text style={styles.h1}>That link has expired</Text>
        <Text style={styles.muted}>Reset links only work for 30 minutes, and only once.</Text>
        <View style={styles.alertWarn} accessibilityRole="alert">
          <Icon name="warning" size={22} color={styles.alertWarnText.color} duotone />
          <Text style={styles.alertWarnText}>Ask for a fresh link and we will send it right away.</Text>
        </View>
        <KitButton label="Send me a new link" onPress={() => router.replace("/forgot-password")} />
        <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center", marginTop: kit.space["2"] }}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </PremiumAuthShell>
    );
  }

  if (phase === "success") {
    return (
      <PremiumAuthShell coachLine={coachLine} coachMood="happy" testID="reset-password-success">
        <Text style={styles.h1}>Password changed</Text>
        <SentBox icon={<Icon name="check" size={28} color={kit.colors.brand} duotone />}>
          <Text style={styles.sentMain}>You are all set. You were signed out on other devices to keep your account safe.</Text>
        </SentBox>
        <KitButton label="Continue to Learn" onPress={() => router.replace("/(tabs)/academy")} />
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

      <PremiumPasswordField label="New password" value={password} onChangeText={setPassword} invalid={showPwError} testID="reset-new-password" />
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
        <FieldAlert message={confirmHelp ?? "These two do not match. Type the same password in both boxes."} />
      ) : null}
      {!showConfirmError && passwordsMatch(password, confirm) && confirm.length > 0 ? <Text style={styles.help}>Matches.</Text> : null}

      <KitButton label="Save new password" onPress={() => void save()} loading={busy} />

      <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center", marginTop: kit.space["2"] }}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </PremiumAuthShell>
  );
}
