import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth";
import { PasswordField } from "@/PasswordField";
import { Logo } from "@/Logo";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { useType } from "@/typography";
import { font, radius, space } from "@/theme";

import { PRIVACY_URL } from "@/constants";

type GoogleBtnProps = {
  disabled?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function LoginScreen() {
  const { login, register, loginWithGoogle, continueAsGuest, exitGuest, guest } = useAuth();
  const { colors } = useAppTheme();
  const type = useType();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [GoogleBtn, setGoogleBtn] = useState<ComponentType<GoogleBtnProps> | null>(null);
  const parityAutoLoginKey = useRef<string | null>(null);
  const isRegister = mode === "register";

  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);

  useEffect(() => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim()) return;
    void import("@/GoogleSignInButton")
      .then((mod) => setGoogleBtn(() => mod.GoogleSignInButton))
      .catch(() => setGoogleBtn(null));
  }, []);

  // Maestro cannot reliably fill React-controlled RN inputs — parity deep-link
  // login seeds credentials (and auto-submits) when EXPO_PUBLIC_PARITY=1.
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_PARITY !== "1") return;
    const rawEmail = params.email;
    const rawPassword = params.password;
    const e = (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail)?.trim() ?? "";
    const p = (Array.isArray(rawPassword) ? rawPassword[0] : rawPassword) ?? "";
    if (!e || !p) return;
    const key = `${e}\0${p}`;
    if (parityAutoLoginKey.current === key) return;
    parityAutoLoginKey.current = key;
    if (guest) exitGuest();
    setMode("login");
    setEmail(e);
    setPassword(p);
    setBusy(true);
    setError(null);
    void login(e, p)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        parityAutoLoginKey.current = null;
      })
      .finally(() => setBusy(false));
  }, [exitGuest, guest, login, params.email, params.password]);

  const handleGoogle = useCallback(
    async (idToken: string) => {
      setError(null);
      setBusy(true);
      try {
        await loginWithGoogle(idToken);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Google sign-in failed";
        setError(msg === "Google sign-in is not configured." ? "Google sign-in is not available right now." : msg);
      } finally {
        setBusy(false);
      }
    },
    [loginWithGoogle],
  );

  const handleGoogleError = useCallback((message: string) => setError(message), []);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(email, password, name);
      else await login(email, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg === "invalid registration" || msg === "invalid credentials") {
        setError("Check your email and password (minimum 8 characters).");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedSafeArea>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.center}>
        <View style={{ alignItems: "center", marginBottom: space[2] }}>
          <Logo size={40} />
        </View>
        <Text style={styles.title}>{isRegister ? "Enroll at ChessSchool" : "Welcome back"}</Text>
        <Text style={styles.subtitle}>
          {isRegister ? "Create your student account to save progress and earn your ID." : "Log in to continue your studies."}
        </Text>

        {isRegister && (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.ink300}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          testID="login-email"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.ink300}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="off"
          textContentType="oneTimeCode"
          importantForAutofill="no"
        />
        <PasswordField
          testID="login-password"
          placeholder="Password"
          placeholderTextColor={colors.ink300}
          value={password}
          onChangeText={setPassword}
          autoComplete="off"
          textContentType="oneTimeCode"
          importantForAutofill="no"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable testID="login-submit" style={styles.button} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegister ? "Enroll" : "Log in"}</Text>}
        </Pressable>

        <Pressable testID="login-mode-register" onPress={() => setMode(isRegister ? "login" : "register")}>
          <Text style={styles.switch}>{isRegister ? "Already enrolled? Log in" : "New here? Enroll now"}</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.or}>or</Text>
          <View style={styles.line} />
        </View>
        {GoogleBtn ? (
          <GoogleBtn disabled={busy} onIdToken={handleGoogle} onError={handleGoogleError} />
        ) : null}
        <Pressable style={[styles.guestButton, { marginTop: space[3] }]} onPress={continueAsGuest} disabled={busy}>
          <Text style={styles.guestText}>Continue as a guest</Text>
        </Pressable>
        <Text style={styles.guestHint}>Browse & play without an account — enroll later to save progress.</Text>
        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
          <Text style={styles.legal}>Privacy policy</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </ThemedSafeArea>
  );
}

function makeStyles(colors: ReturnType<typeof useAppTheme>["colors"], type: ReturnType<typeof useType>) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: "center", paddingHorizontal: space[6] },
    title: { ...type.xl, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
    subtitle: { ...type.sm, fontFamily: font.medium, color: colors.ink500, textAlign: "center", marginTop: 6, marginBottom: space[5] },
    input: {
      height: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.surfaceCard,
      paddingHorizontal: 14,
      fontSize: 16,
      fontFamily: font.medium,
      color: colors.ink,
      marginBottom: space[3],
    },
    error: { color: colors.danger, fontFamily: font.semibold, marginBottom: 10, textAlign: "center" },
    button: {
      height: 54,
      borderRadius: radius.md,
      backgroundColor: colors.brand,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
    },
    buttonText: { color: "#fff", fontSize: 17, fontFamily: font.bold },
    switch: { color: colors.brand, fontFamily: font.semibold, textAlign: "center", marginTop: space[4] },
    divider: { flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[5], marginBottom: space[3] },
    line: { flex: 1, height: 1, backgroundColor: colors.hairline },
    or: { color: colors.ink300, fontFamily: font.bold, fontSize: 13 },
    guestButton: {
      height: 50,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.brand,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surfaceCard,
    },
    guestText: { color: colors.brand, fontSize: 16, fontFamily: font.bold },
    guestHint: { color: colors.ink500, fontSize: 12, fontFamily: font.medium, textAlign: "center", marginTop: 10 },
    legal: { color: colors.brand, fontSize: 12, fontFamily: font.bold, textAlign: "center", marginTop: space[4] },
  });
}
