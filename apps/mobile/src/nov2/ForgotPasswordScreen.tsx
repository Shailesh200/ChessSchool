import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, useColorScheme } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/Icon";
import { useSettings } from "@/settings";
import { isPremiumLook } from "@/nov2/uiLook";
import { KitButton, usePremiumKitTheme } from "@/components/kit";
import { FieldAlert } from "@/nov2/PremiumPasswordField";
import { PremiumAuthShell, SentBox } from "@/nov2/PremiumAuthShell";
import { createBoaAuthStyles } from "@/nov2/boaKitStyles";
import { resolvePremiumColorMode } from "@/themeMode";
import {
  RESEND_COOLDOWN_SEC,
  requestPasswordResetEmail,
  validateForgotEmail,
} from "@/nov2/passwordReset";

type Phase = "entry" | "sent";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phase?: string }>();
  const { uiKit, themeMode } = useSettings();
  const premium = isPremiumLook({ uiKit });
  const kit = usePremiumKitTheme();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createBoaAuthStyles(kit, mode), [kit, mode]);

  const capturePhase =
    process.env.EXPO_PUBLIC_BOA_CAPTURE === "1" && params.phase === "sent" ? ("sent" as const) : undefined;
  const [phase, setPhase] = useState<Phase>(capturePhase ?? "entry");
  const [email, setEmail] = useState(capturePhase === "sent" ? "student@example.com" : "");
  const [sentTo, setSentTo] = useState(capturePhase === "sent" ? "student@example.com" : "");
  const [fieldError, setFieldError] = useState<string | null>(
    process.env.EXPO_PUBLIC_BOA_CAPTURE === "1" && params.phase === "error" ? "Enter a valid email address." : null,
  );
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
          placeholderTextColor={kit.colors.ink300}
        />
        <KitButton label="Send reset link" onPress={() => void sendLink()} loading={busy} />
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
              placeholderTextColor={kit.colors.ink300}
            />
            {fieldError ? <FieldAlert message={fieldError} /> : <Text style={styles.help}>The email you signed up with.</Text>}
          </View>
          <KitButton label="Send reset link" onPress={() => void sendLink()} loading={busy} />
        </>
      ) : (
        <>
          <Text style={styles.h1}>Check your email</Text>
          <SentBox icon={<Icon name="message" size={28} color={kit.colors.brand} duotone />}>
            <Text style={styles.sentMain}>
              We sent a reset link to <Text style={styles.sentBold}>{sentTo}</Text>.
            </Text>
            <Text style={styles.help}>The link works for 30 minutes. Nothing there? Check spam.</Text>
          </SentBox>
          <KitButton label="Resend link" variant="outline" disabled={resendIn > 0 || busy} onPress={() => void sendLink()} />
          <Text style={[styles.help, styles.center]}>
            {resendIn > 0 ? `You can ask for another link in ${resendIn} seconds.` : "You can ask for another link now."}
          </Text>
        </>
      )}

      <View style={{ alignItems: "center", marginTop: kit.space["2"] }}>
        <Pressable onPress={() => router.replace("/login")} accessibilityRole="link">
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    </PremiumAuthShell>
  );
}
