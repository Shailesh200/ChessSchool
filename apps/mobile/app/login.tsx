import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth";
import { colors, font, radius } from "@/theme";

export default function LoginScreen() {
  const { login, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(email, password, name);
      else await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
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
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.ink300}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
        <Pressable style={styles.guestButton} onPress={continueAsGuest} disabled={busy}>
          <Text style={styles.guestText}>Continue as a guest</Text>
        </Pressable>
        <Text style={styles.guestHint}>Browse & play without an account — enroll later to save progress.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  logo: { fontSize: 22, fontFamily: font.bold, color: colors.brand, textAlign: "center", marginBottom: 24 },
  title: { fontSize: 26, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: font.medium, color: colors.ink500, textAlign: "center", marginTop: 6, marginBottom: 20 },
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
    marginBottom: 12,
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
  switch: { color: colors.brand, fontFamily: font.semibold, textAlign: "center", marginTop: 18 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22, marginBottom: 14 },
  line: { flex: 1, height: 1, backgroundColor: colors.hairline },
  or: { color: colors.ink300, fontFamily: font.bold, fontSize: 13 },
  guestButton: { height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfaceCard },
  guestText: { color: colors.brand, fontSize: 16, fontFamily: font.bold },
  guestHint: { color: colors.ink500, fontSize: 12, fontFamily: font.medium, textAlign: "center", marginTop: 10 },
});
