"use client";

import { cleanName, copy, guestPayload, validEmail, validPassword } from "@chessschool/design";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";
import { Cody } from "./Lottie";
import { GoogleButton } from "./GoogleButton";
import { Button, TextField, TopBar } from "./ui";

type Mode = "login" | "signup";
type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

export function AuthForm({ mode }: { mode: Mode }) {
  const { state, ready, signedIn, cue } = useApp();
  const router = useRouter();
  const [nameDraft, setName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  // Until the learner types, show the name they already gave as a guest.
  const name = nameDraft ?? (ready ? state.profile.name : "");
  const edit = (field: keyof Errors, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const submit = async (ev: React.FormEvent) => {
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
      router.replace("/today");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      cue("gentle-no");
    } finally {
      setBusy(false);
    }
  };

  const hasError = Object.keys(errors).length > 0;

  return (
    <div className="flow flow-auth">
      <TopBar />
      <div className="auth-head">
        <Cody animation={hasError ? "oops" : signup ? "happy" : "wave"} size={120} label={copy.a11y.mascot} />
        <h1>{signup ? copy.auth.signupTitle : copy.auth.loginTitle}</h1>
        <p className="lead">{signup ? copy.auth.signupBody : copy.auth.loginBody}</p>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate>
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
        />
        {errors.form ? (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        ) : null}
        <Button type="submit" block loading={busy}>
          {signup ? copy.auth.signup : copy.auth.login}
        </Button>
      </form>

      <GoogleButton
        onToken={async (idToken) => {
          setBusy(true);
          try {
            signedIn(await api.google({ idToken, guest: guestPayload(state) }));
            cue("success");
            router.replace("/today");
          } catch (err) {
            setErrors({ form: errorMessage(err) });
            cue("gentle-no");
          } finally {
            setBusy(false);
          }
        }}
      />

      <div className="auth-links">
        <Link href={signup ? "/login" : "/signup"} className="link">
          {signup ? copy.auth.toLogin : copy.auth.toSignup}
        </Link>
        {!state.account ? (
          <Link href="/today" className="link link-muted">
            {copy.auth.guest}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
