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
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { PasswordField } from "@/PasswordField";
import { PRIVACY_URL } from "@/constants";
import { CoachRow } from "./CoachRow";
import { KitButton, KitLogo, usePremiumKitTheme } from "@/components/kit";
import { PREMIUM_COLUMN, createPremiumAuthStyles } from "./premiumKitStyles";
import { resolvePremiumColorMode } from "@/themeMode";
import { useSettings } from "@/settings";

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
  const { themeMode } = useSettings();
  const kit = usePremiumKitTheme();
  const scheme = useColorScheme();
  const colorMode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createPremiumAuthStyles(kit, colorMode), [kit, colorMode]);
  const layout = useMemo(() => StyleSheet.create({ flex: { flex: 1, backgroundColor: kit.colors.bg, ...PREMIUM_COLUMN } }), [kit.colors.bg]);

  const isSignup = mode === "signup";
  const isErrors = mode === "errors";

  const title = isSignup ? "Create your account" : isErrors ? "Check your details" : "Sign in";
  const subtitle = isSignup
    ? "Save progress and earn your Student ID."
    : isErrors
      ? "Fix the fields below and try again."
      : "Pick up where you left off.";

  return (
    <KeyboardAvoidingView style={layout.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.logoFrame}>
          <KitLogo withText size={24} />
        </View>
        <CoachRow
          slug="otto"
          mood={isErrors ? "encouraging" : "happy"}
          text={
            isErrors
              ? "Almost. Check the fields and try once more."
              : isSignup
                ? "Let's get you enrolled — it only takes a minute."
                : "Welcome back! Ready for one small win today?"
          }
        />
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
              placeholderTextColor={kit.colors.ink300}
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
            placeholderTextColor={kit.colors.ink300}
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
            placeholderTextColor={kit.colors.ink300}
            containerStyle={isErrors ? styles.inputBad : undefined}
          />
        </View>

        {!isSignup && (
          <Pressable onPress={() => router.push("/forgot-password")} style={styles.forgot}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        )}

        {!isErrors && error ? <Text style={styles.errInline}>{error}</Text> : null}

        <KitButton testID="login-submit" label={isSignup ? "Create account" : "Sign in"} onPress={onSubmit} loading={busy} disabled={busy} />

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
