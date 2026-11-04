import { cleanName, copy, guestPayload, validEmail, validPassword } from "@chessschool/design";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { api, errorMessage } from "@/lib/api";
import { googleAvailable, googleIdToken } from "@/lib/google";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { GoogleMark } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Flow, T, TextField, TopBar } from "./ui";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { state, signedIn, cue } = useApp();
  const { c } = useTheme();
  const signup = mode === "signup";
  const [name, setName] = useState(state.profile.name);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);

  const edit = (field: keyof Errors, set: (v: string) => void) => (v: string) => {
    set(v);
    if (errors[field] || errors.form) setErrors(({ [field]: _, form: __, ...rest }) => rest);
  };

  const done = async (run: () => Promise<Parameters<typeof signedIn>[0] | null>) => {
    setBusy(true);
    try {
      const auth = await run();
      if (!auth) return;
      await signedIn(auth);
      cue("success");
      router.replace("/today");
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
    void done(() => (signup ? api.register({ name: cleanName(name), email: email.trim(), password, guest }) : api.login({ email: email.trim(), password, guest })));
  };

  const google = async () => {
    void done(async () => {
      const idToken = await googleIdToken();
      return idToken ? api.google({ idToken, guest: guestPayload(state) }) : null;
    });
  };

  const hasError = Object.keys(errors).length > 0;

  return (
    <Flow top={<TopBar />} scroll>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Cody animation={hasError ? "oops" : signup ? "happy" : "wave"} size={112} label={copy.a11y.mascot} />
        <T role="title" header center>
          {signup ? copy.auth.signupTitle : copy.auth.loginTitle}
        </T>
        <T role="body" color="textMuted" center>
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
        <View accessibilityRole="alert" style={{ backgroundColor: c.dangerSoft, padding: 14, borderRadius: 14 }}>
          <T role="small" style={{ color: c.dangerText, fontFamily: fonts.medium }}>
            {errors.form}
          </T>
        </View>
      ) : null}
      <Button title={signup ? copy.auth.signup : copy.auth.login} onPress={submit} loading={busy} />

      {googleAvailable() ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            <T role="small" color="textMuted">
              {copy.auth.or}
            </T>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.auth.google}
            onPress={google}
            disabled={busy}
            style={({ pressed }) => ({ minHeight: 56, borderRadius: 28, borderWidth: 2, borderColor: c.line, backgroundColor: c.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: pressed ? 0.8 : 1 })}
          >
            <GoogleMark />
            <T role="label">{copy.auth.google}</T>
          </Pressable>
        </>
      ) : null}

      <View style={{ alignItems: "center", gap: 6, paddingVertical: 8 }}>
        <Button title={signup ? copy.auth.toLogin : copy.auth.toSignup} variant="ghost" onPress={() => router.replace(signup ? "/login" : "/signup")} />
        {!state.account ? <Button title={copy.auth.guest} variant="ghost" onPress={() => router.replace("/today")} /> : null}
      </View>
    </Flow>
  );
}
