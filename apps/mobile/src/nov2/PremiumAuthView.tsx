import { useMemo, type ComponentType } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { PasswordField } from "@/PasswordField";
import { PRIVACY_URL } from "@/constants";
import { CoachRow } from "./CoachRow";
import { KitButton, KitLogo } from "@/components/kit";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "./premiumTokens";

type GoogleBtnProps = {
  disabled?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
};

export type PremiumAuthMode = "signin" | "signup" | "errors";

type Props = {
  mode: PremiumAuthMode;
  onModeChange: (mode: PremiumAuthMode) => void;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  onGuest: () => void;
  GoogleBtn: ComponentType<GoogleBtnProps> | null;
  onGoogle: (token: string) => Promise<void>;
  onGoogleError: (msg: string) => void;
};

export function PremiumAuthView({
  mode,
  onModeChange,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  error,
  busy,
  onSubmit,
  onGuest,
  GoogleBtn,
  onGoogle,
  onGoogleError,
}: Props) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const isErrors = mode === "errors";
  const styles = useMemo(() => makeStyles(), []);

  const title = isSignup ? "Create your account" : isErrors ? "Check your details" : "Sign in";
  const subtitle = isSignup
    ? "Save progress and earn your Student ID."
    : isErrors
      ? "Fix the fields below and try again."
      : "Pick up where you left off.";

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.logoFrame}>
          <KitLogo withText size={24} />
        </View>
        <CoachRow slug="otto" mood="happy" text="Welcome back! Ready for one small win today?" />
        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>

        {isErrors && error && (
          <View style={styles.alert}>
            <Text style={styles.alertText}>{error}</Text>
          </View>
        )}

        {isSignup && (
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Your name"
              placeholderTextColor={premiumColors.textSubtle}
            />
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email"
            style={[styles.input, isErrors && styles.inputBad]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            placeholderTextColor={premiumColors.textSubtle}
          />
          <Text style={styles.help}>For example: name@example.com</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <PasswordField
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={premiumColors.textSubtle}
            containerStyle={isErrors ? styles.inputBad : undefined}
          />
        </View>

        {!isSignup && (
          <Pressable onPress={() => router.push("/forgot-password")} style={styles.forgot}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        )}

        {!isErrors && error ? <Text style={styles.errInline}>{error}</Text> : null}

        <KitButton
          testID="login-submit"
          label={isSignup ? "Create account" : "Sign in"}
          onPress={onSubmit}
          loading={busy}
          disabled={busy}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.or}>or</Text>
          <View style={styles.line} />
        </View>

        {GoogleBtn ? <GoogleBtn disabled={busy} onIdToken={onGoogle} onError={onGoogleError} /> : null}
        <KitButton label="Continue as guest" variant="outline" onPress={onGuest} disabled={busy} />
        <Text style={styles.helpCenter}>Your progress stays on this device. Make an account any time to save it.</Text>

        <View style={styles.foot}>
          <Text style={styles.muted}>{isSignup ? "Already enrolled?" : "New here?"}</Text>
          <Pressable testID="login-mode-register" onPress={() => onModeChange(isSignup ? "signin" : "signup")}>
            <Text style={styles.link}>{isSignup ? "Sign in" : "Create an account"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
          <Text style={[styles.link, styles.legal]}>Privacy policy</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: premiumColors.bg },
    wrap: { padding: premiumSpace[5], gap: premiumSpace[4], paddingBottom: premiumSpace[8] },
    logoFrame: {
      alignSelf: "center",
      backgroundColor: premiumColors.brandSoft,
      borderRadius: premiumRadius.xl,
      paddingHorizontal: premiumSpace[5],
      paddingVertical: premiumSpace[3],
    },
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
    help: { ...premiumType.caption, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
    helpCenter: { ...premiumType.caption, fontFamily: premiumFont.ui, color: premiumColors.textMuted, textAlign: "center" },
    forgot: { alignSelf: "flex-end" },
    link: { color: premiumColors.textLink, fontFamily: premiumFont.uiBold, fontSize: 16 },
    errInline: { color: premiumColors.error, fontFamily: premiumFont.uiBold, textAlign: "center" },
    alert: {
      backgroundColor: premiumColors.errorSoft,
      borderRadius: premiumRadius.md,
      padding: premiumSpace[3],
    },
    alertText: { color: premiumColors.errorText, fontFamily: premiumFont.uiBold },
    divider: { flexDirection: "row", alignItems: "center", gap: premiumSpace[3] },
    line: { flex: 1, height: 1.5, backgroundColor: premiumColors.line },
    or: { fontFamily: premiumFont.uiBold, color: premiumColors.textMuted, fontSize: 14 },
    foot: { flexDirection: "row", justifyContent: "center", gap: 6, flexWrap: "wrap" },
    legal: { textAlign: "center", marginTop: premiumSpace[2] },
  });
}
