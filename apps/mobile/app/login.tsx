import { useCallback, useEffect, useState, type ComponentType } from "react";
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
import { useAuth } from "@/auth";
import { PasswordField } from "@/PasswordField";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, space, type } from "@/theme";

import { PRIVACY_URL } from "@/constants";

type GoogleBtnProps = {
  disabled?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function LoginScreen() {
  const { login, register, loginWithGoogle, continueAsGuest } = useAuth();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [GoogleBtn, setGoogleBtn] = useState<ComponentType<GoogleBtnProps> | null>(null);
  const isRegister = mode === "register";

  useEffect(() => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim()) return;
    void import("@/GoogleSignInButton")
      .then((mod) => setGoogleBtn(() => mod.GoogleSignInButton))
      .catch(() => setGoogleBtn(null));
  }, []);

  const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: "center", paddingHorizontal: space[6] },
    logo: { fontSize: 22, fontFamily: font.bold, color: colors.brand, textAlign: "center", marginBottom: space[6] },
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
        <Text style={styles.logo}>♟️ ChessSchool</Text>
        <Text style={styles.title}>{isRegister ? "Enroll at ChessSchool" : "Welcome back"}</Text>
        <Text style={styles.subtitle}>
          {isRegister ? "Create your student account to save progress." : "Log in to continue your studies."}
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
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.ink300}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <PasswordField
          placeholder="Password"
          placeholderTextColor={colors.ink300}
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegister ? "Enroll" : "Log in"}</Text>}
        </Pressable>

        <Pressable onPress={() => setMode(isRegister ? "login" : "register")}>
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
