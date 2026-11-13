import { ApiError, cleanName, copy, guestPayload, validEmail, validPassword } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { appleAvailable, appleCredential, appleModule, isAppleCancel } from "@/lib/apple";
import { api, errorMessage } from "@/lib/api";
import { googleAvailable, googleIdToken } from "@/lib/google";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { GoogleMark } from "./Icon";
import { Cody } from "./Lottie";
import { Flow, T, TextField, TopBar } from "./ui";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;
type Kind = "login" | "signup" | "google";

function authHref(mode: "login" | "signup", email: string) {
  const value = email.trim();
  const path = mode === "login" ? "/login" : "/signup";
  return value ? `${path}?email=${encodeURIComponent(value)}` : path;
}

/** Prefer the token colour, and fall back when it would disappear on the fill. */
function labelOn(bg: string, preferred: string): string {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    if (h.length < 6) return 0;
    const chan = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(2)) + 0.0722 * lin(chan(4));
  };
  if (!bg.startsWith("#") || !preferred.startsWith("#")) return preferred;
  const a = lum(bg);
  const b = lum(preferred);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (ratio >= 3) return preferred;
  return a > 0.55 ? "#1C1B2E" : "#FFFFFF";
}

export function AuthForm({ mode, initialEmail = "", topSpacing = 8 }: { mode: "login" | "signup"; initialEmail?: string; topSpacing?: number }) {
  const { state, signedIn, cue } = useApp();
  const { c, scheme } = useTheme();
  const signup = mode === "signup";
  const [appleOn, setAppleOn] = useState(false);
  const [name, setName] = useState(state.profile.name);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);

  useEffect(() => {
    setErrors({});
    setPassword("");
  }, [mode]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let live = true;
    void appleAvailable().then((ok) => {
      if (live) setAppleOn(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  const edit = (field: keyof Errors, set: (v: string) => void) => (v: string) => {
    set(v);
    if (errors[field] || errors.form) setErrors(({ [field]: _, form: __, ...rest }) => rest);
  };

  const done = async (run: () => Promise<Parameters<typeof signedIn>[0] | null>, kind: Kind) => {
    setBusy(true);
    try {
      const auth = await run();
      if (!auth) return;
      const firstRun = !state.seenWelcome;
      await signedIn(auth);
      cue("success");
      router.replace(kind === "login" || !firstRun ? "/today" : "/welcome");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      cue("gentle-no");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const e: Errors = {};
    if (signup && !cleanName(name)) e.name = copy.auth.errors.nameRequired;
    if (!validEmail(email)) e.email = copy.auth.errors.emailInvalid;
    if (signup ? !validPassword(password) : !password) e.password = copy.auth.errors.passwordShort;
    setErrors(e);
    if (Object.keys(e).length) return cue("gentle-no");
    const guest = guestPayload(state);
    void done(() => (signup ? api.register({ name: cleanName(name), email: email.trim(), password, guest }) : api.login({ email: email.trim(), password, guest })), signup ? "signup" : "login");
  };

  const google = () => {
    void done(async () => {
      const idToken = await googleIdToken();
      return idToken ? api.google({ idToken, guest: guestPayload(state) }) : null;
    }, "google");
  };

  const apple = () => {
    if (busy) return;
    void (async () => {
      setBusy(true);
      try {
        const cred = await appleCredential();
        if (!cred) return;
        const auth = await api.apple(cred);
        const firstRun = !state.seenWelcome;
        await signedIn(auth);
        cue("success");
        router.replace(firstRun ? "/welcome" : "/today");
      } catch (err) {
        if (isAppleCancel(err)) return;
        setErrors({ form: err instanceof ApiError ? errorMessage(err) : copy.auth.appleFailed });
        cue("gentle-no");
      } finally {
        setBusy(false);
      }
    })();
  };

  const switchMode = () => {
    setErrors({});
    setPassword("");
    router.replace(authHref(signup ? "login" : "signup", email));
  };

  const goGuest = () => {
    router.replace(state.seenWelcome ? "/today" : "/welcome");
  };

  const continueLabel = copy.auth.continueAs.trim();
  const googleLabel = copy.auth.googleShort.trim();
  const guestLabel = copy.auth.guestShort.trim();
  const showGoogle = googleAvailable() && googleLabel.length > 0;
  const showGuest = !state.account && guestLabel.length > 0;
  const showApple = Platform.OS === "ios" && appleOn;
  const showContinue = continueLabel.length > 0 && (showGoogle || showGuest || showApple);
  const submitLabel = (signup ? copy.auth.signup : copy.auth.login).trim();
  const hasError = Object.keys(errors).length > 0;

  return (
    <Flow top={<View style={{ paddingTop: topSpacing }}><TopBar /></View>} scroll={signup}>
      <View style={{ alignSelf: "stretch", width: "100%", gap: signup ? 10 : 8 }}>
        <View style={{ alignItems: "center", gap: 4, paddingTop: signup ? 0 : 4 }}>
          <Cody animation={hasError ? "oops" : signup ? "happy" : "wave"} size={signup ? 88 : 68} label={copy.a11y.mascot} />
          <T role="title" header center style={{ alignSelf: "stretch", textAlign: "center", fontSize: signup ? 24 : 22, lineHeight: 28 }}>
            {signup ? copy.auth.signupTitle : copy.auth.loginTitle}
          </T>
          <T role="small" color="textMuted" center style={{ alignSelf: "stretch", textAlign: "center" }}>
            {signup ? copy.auth.signupBody : copy.auth.loginBody}
          </T>
        </View>

        {signup ? (
          <TextField
            label={copy.auth.name}
            placeholder={copy.auth.namePlaceholder}
            value={name}
            onChangeText={edit("name", setName)}
            error={errors.name}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            maxLength={40}
          />
        ) : null}
        <TextField
          ref={emailRef}
          label={copy.auth.email}
          placeholder={copy.auth.emailPlaceholder}
          value={email}
          onChangeText={edit("email", setEmail)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
        />
        <TextField
          ref={pwRef}
          label={copy.auth.password}
          placeholder={signup ? copy.auth.passwordPlaceholder : undefined}
          password
          value={password}
          onChangeText={edit("password", setPassword)}
          error={errors.password}
          hint={signup ? copy.auth.passwordHint : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          textContentType={signup ? "newPassword" : "password"}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {errors.form ? (
          <View accessibilityRole="alert" style={{ backgroundColor: c.dangerSoft, padding: 12, borderRadius: 14 }}>
            <T role="small" style={{ color: c.dangerText, fontFamily: fonts.medium }}>
              {errors.form}
            </T>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? copy.auth.working : submitLabel}
          accessibilityState={{ disabled: busy || !submitLabel, busy }}
          disabled={busy || !submitLabel}
          onPress={submit}
          style={{ alignSelf: "stretch" }}
        >
          <View style={{ minHeight: 52, borderRadius: 999, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
            <T role="label" center numberOfLines={1} style={{ color: labelOn(c.brand, c.onBrand), textAlign: "center", width: "100%" }}>
              {busy ? copy.auth.working : submitLabel}
            </T>
          </View>
        </Pressable>

        {showContinue ? (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              <T role="small" color="textMuted">
                {copy.auth.or}
              </T>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            </View>
            <T role="small" color="textMuted" center style={{ textAlign: "center" }}>
              {continueLabel}
            </T>
            {showApple ? <AppleSignInButton signup={signup} scheme={scheme} disabled={busy} onPress={apple} /> : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {showGoogle ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.auth.google}
                  onPress={google}
                  disabled={busy}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: c.line,
                    backgroundColor: c.card,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingHorizontal: 8,
                    opacity: busy ? 0.6 : pressed ? 0.85 : 1,
                  })}
                >
                  <GoogleMark />
                  <T role="label" numberOfLines={1}>
                    {googleLabel}
                  </T>
                </Pressable>
              ) : null}
              {showGuest ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.auth.guest}
                  onPress={goGuest}
                  disabled={busy}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: c.line,
                    backgroundColor: c.card,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 8,
                    opacity: busy ? 0.6 : pressed ? 0.85 : 1,
                  })}
                >
                  <T role="label" center numberOfLines={1} style={{ textAlign: "center" }}>
                    {guestLabel}
                  </T>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={switchMode} hitSlop={8} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          <T role="label" center color="brandText" style={{ textAlign: "center" }}>
            {signup ? copy.auth.toLogin : copy.auth.toSignup}
          </T>
        </Pressable>
      </View>
    </Flow>
  );
}

/** Official Sign in with Apple control. Full width so the system title is not clipped. */
function AppleSignInButton({ signup, scheme, disabled, onPress }: { signup: boolean; scheme: "light" | "dark"; disabled?: boolean; onPress: () => void }) {
  const mod = appleModule();
  if (!mod || Platform.OS !== "ios") return null;
  const NativeButton = mod.AppleAuthenticationButton;
  return (
    <NativeButton
      buttonType={signup ? mod.AppleAuthenticationButtonType.SIGN_UP : mod.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={scheme === "dark" ? mod.AppleAuthenticationButtonStyle.WHITE : mod.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={24}
      style={{ width: "100%", height: 48 }}
      onPress={() => {
        if (!disabled) onPress();
      }}
    />
  );
}
