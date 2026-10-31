import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/Icon";
import { useSettings } from "@/settings";
import { isPremiumLook } from "@/nov2/uiLook";
import { DexButton } from "@/nov2/DexButton";
import { FieldAlert, PremiumPasswordField } from "@/nov2/PremiumPasswordField";
import { PremiumAuthShell, SentBox } from "@/nov2/PremiumAuthShell";
import {
  RESEND_COOLDOWN_SEC,
  requestPasswordResetEmail,
  validateForgotEmail,
} from "@/nov2/passwordReset";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "@/nov2/premiumTokens";

type Phase = "entry" | "sent";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { uiLook } = useSettings();
  const premium = isPremiumLook({ uiLook });
  const [phase, setPhase] = useState<Phase>("entry");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendLink() {
    const v = validateForgotEmail(email);
    if (!v.ok) {
      setFieldError(v.message);
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await requestPasswordResetEmail(v.email);
      setSentTo(v.email);
      setPhase("sent");
      setResendIn(RESEND_COOLDOWN_SEC);
    } finally {
      setBusy(false);
    }
  }

  if (!premium) {
    return (
      <PremiumAuthShell coachLine="Enter your email for a reset link." testID="forgot-password-classic">
        <Text style={styles.h1}>Forgot password</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Email"
        />
        <DexButton label="Send reset link" onPress={() => void sendLink()} loading={busy} />
        <Pressable onPress={() => router.replace("/login")}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </PremiumAuthShell>
    );
  }

  const coachLine =
    phase === "sent"
      ? "Link's on its way. Check your inbox."
      : fieldError
        ? "Almost. Check the email and try once more."
        : "No stress. Tell me your email and I'll send a link.";

  const coachMood = phase === "sent" ? "happy" : fieldError ? "encouraging" : "neutral";

  return (
    <PremiumAuthShell coachLine={coachLine} coachMood={coachMood} testID="forgot-password">
      {phase === "entry" ? (
        <>
          <Text style={styles.h1}>Forgot your password?</Text>
          <Text style={styles.muted}>Tell us your email. We will send you a link to choose a new one.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="forgot-email"
              style={[styles.input, fieldError && styles.inputBad]}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (fieldError) setFieldError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="name@example.com"
              placeholderTextColor={premiumColors.textSubtle}
            />
            {fieldError ? <FieldAlert message={fieldError} /> : <Text style={styles.help}>The email you signed up with.</Text>}
          </View>
          <DexButton label="Send reset link" onPress={() => void sendLink()} loading={busy} />
        </>
      ) : (
        <>
          <Text style={styles.h1}>Check your email</Text>
          <SentBox icon={<Icon name="message" size={28} color={premiumColors.brand} duotone />}>
            <Text style={styles.sentMain}>
              We sent a reset link to <Text style={styles.sentBold}>{sentTo}</Text>.
            </Text>
            <Text style={styles.help}>The link works for 30 minutes. Nothing there? Check spam.</Text>
          </SentBox>
          <DexButton
            label="Resend link"
            variant="line"
            disabled={resendIn > 0 || busy}
            onPress={() => void sendLink()}
          />
          <Text style={[styles.help, styles.center]}>
            {resendIn > 0 ? `You can ask for another link in ${resendIn} seconds.` : "You can ask for another link now."}
          </Text>
        </>
      )}

      <View style={styles.foot}>
        <Pressable onPress={() => router.replace("/login")} accessibilityRole="link">
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    </PremiumAuthShell>
  );
}

const styles = StyleSheet.create({
  h1: { ...premiumType.h1, fontFamily: premiumFont.display, color: premiumColors.text },
  muted: { ...premiumType.body, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
  field: { gap: 6 },
  label: { ...premiumType.body, fontFamily: premiumFont.uiBold, color: premiumColors.text },
  input: {
    minHeight: 56,
    borderRadius: premiumRadius.lg,
    borderWidth: 1.5,
    borderColor: premiumColors.lineStrong,
    backgroundColor: premiumColors.surface,
    paddingHorizontal: premiumSpace[4],
    fontSize: 16,
    fontFamily: premiumFont.ui,
    color: premiumColors.text,
  },
  inputBad: { borderColor: premiumColors.error, borderWidth: 2 },
  help: { fontSize: 13, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
  center: { textAlign: "center" },
  sentMain: { ...premiumType.body, fontFamily: premiumFont.ui, color: premiumColors.text, textAlign: "center" },
  sentBold: { fontFamily: premiumFont.uiBold },
  foot: { alignItems: "center", marginTop: premiumSpace[2] },
  link: { color: premiumColors.textLink, fontFamily: premiumFont.uiBold, fontSize: 16, textDecorationLine: "underline" },
});
