"use client";

import { cleanName, copy, guestPayload, validEmail, validPassword } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";
import { Cody } from "./Lottie";
import { GoogleButton } from "./GoogleButton";
import { Button, TextField, TopBar } from "./ui";

type Mode = "login" | "signup";
type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

function authHref(mode: Mode, email: string) {
  const value = email.trim();
  const path = mode === "login" ? "/login" : "/signup";
  return value ? `${path}?email=${encodeURIComponent(value)}` : path;
}

const altButton: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 48,
  borderRadius: 999,
  border: "2px solid var(--cs-line)",
  background: "var(--cs-card)",
  color: "var(--cs-text)",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 10px",
};

export function AuthForm({ mode, initialEmail = "" }: { mode: Mode; initialEmail?: string }) {
  const { state, ready, signedIn, cue } = useApp();
  const router = useRouter();
  const [nameDraft, setName] = useState<string | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const name = nameDraft ?? (ready ? state.profile.name : "");

  useEffect(() => {
    setErrors({});
    setPassword("");
  }, [mode]);

  const edit = (field: keyof Errors, set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    if (errors[field] || errors.form) setErrors(({ [field]: _, form: __, ...rest }) => rest);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (signup && !cleanName(name)) e.name = copy.auth.errors.nameRequired;
    if (!validEmail(email)) e.email = copy.auth.errors.emailInvalid;
    if (signup ? !validPassword(password) : !password) e.password = copy.auth.errors.passwordShort;
    return e;
  };

  const goNext = (kind: "login" | "signup" | "google") => {
    const firstRun = !state.seenWelcome;
    router.replace(kind === "login" || !firstRun ? "/today" : "/welcome");
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      cue("gentle-no");
      return;
    }
    setBusy(true);
    try {
      const guest = guestPayload(state);
      const auth = signup
        ? await api.register({ name: cleanName(name), email: email.trim(), password, guest })
        : await api.login({ email: email.trim(), password, guest });
      signedIn(auth);
      cue("success");
      goNext(signup ? "signup" : "login");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      cue("gentle-no");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setErrors({});
    setPassword("");
    router.push(authHref(signup ? "login" : "signup", email));
  };

  const goGuest = () => {
    router.push(state.seenWelcome ? "/today" : "/welcome");
  };

  const continueLabel = copy.auth.continueAs.trim();
  const guestLabel = copy.auth.guestShort.trim();
  const googleOn = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) && copy.auth.googleShort.trim().length > 0;
  const guestOn = !state.account && guestLabel.length > 0;
  const showContinue = continueLabel.length > 0 && (googleOn || guestOn);
  const submitLabel = (signup ? copy.auth.signup : copy.auth.login).trim();
  const hasError = Object.keys(errors).length > 0;

  return (
    <div
      className="flow flow-auth"
      style={
        signup
          ? { paddingTop: "calc(16px + env(safe-area-inset-top))" }
          : { gap: 6, paddingTop: "calc(28px + env(safe-area-inset-top))", maxHeight: "100dvh", overflow: "hidden" }
      }
    >
      <TopBar />
      <div className="auth-head" style={{ gap: 4, marginBottom: 0 }}>
        <Cody animation={hasError ? "oops" : signup ? "happy" : "wave"} size={signup ? 96 : 72} label={copy.a11y.mascot} />
        <h1 style={{ textAlign: "center", width: "100%" }}>{signup ? copy.auth.signupTitle : copy.auth.loginTitle}</h1>
        <p className="lead" style={{ textAlign: "center" }}>
          {signup ? copy.auth.signupBody : copy.auth.loginBody}
        </p>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate style={{ gap: signup ? 12 : 8 }}>
        {signup ? (
          <TextField
            label={copy.auth.name}
            placeholder={copy.auth.namePlaceholder}
            autoComplete="given-name"
            value={name}
            onChange={edit("name", setName)}
            error={errors.name}
            maxLength={40}
          />
        ) : null}
        <TextField
          label={copy.auth.email}
          placeholder={copy.auth.emailPlaceholder}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={edit("email", setEmail)}
          error={errors.email}
        />
        <TextField
          label={copy.auth.password}
          placeholder={signup ? copy.auth.passwordPlaceholder : undefined}
          password
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={edit("password", setPassword)}
          error={errors.password}
          hint={signup ? copy.auth.passwordHint : undefined}
          style={{ borderRadius: 16 }}
        />
        {errors.form ? (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        ) : null}
        <Button
          type="submit"
          block
          loading={busy}
          style={{ justifyContent: "center", textAlign: "center", width: "100%", color: "var(--cs-on-brand)", background: "var(--cs-brand)" }}
        >
          {submitLabel}
        </Button>
      </form>

      {showContinue ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div className="divider" style={{ margin: 0 }}>
            <span>{copy.auth.or}</span>
          </div>
          <p style={{ margin: 0, textAlign: "center", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>{continueLabel}</p>
          <div style={{ display: "flex", gap: 10 }}>
            {googleOn ? (
              <GoogleButton
                onToken={async (idToken) => {
                  setBusy(true);
                  try {
                    signedIn(await api.google({ idToken, guest: guestPayload(state) }));
                    cue("success");
                    goNext("google");
                  } catch (err) {
                    setErrors({ form: errorMessage(err) });
                    cue("gentle-no");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : null}
            {guestOn ? (
              <button type="button" onClick={goGuest} style={altButton} aria-label={copy.auth.guest}>
                {guestLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="auth-links" style={{ padding: "4px 0 0" }}>
        <button type="button" className="link" onClick={switchMode} style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }}>
          {signup ? copy.auth.toLogin : copy.auth.toSignup}
        </button>
      </div>
    </div>
  );
}
