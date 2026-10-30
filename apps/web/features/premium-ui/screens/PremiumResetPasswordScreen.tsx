"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  PremiumAuthDexLayout,
  PremiumAuthDexRoot,
} from "@/features/premium-ui/auth/PremiumAuthDexLayout";
import {
  analyzePasswordStrength,
  passwordsMatch,
} from "@/features/premium-ui/auth/passwordStrength";
import {
  postPasswordReset,
  readResetTokenFromSearch,
} from "@/features/premium-ui/auth/resetApi";

function EyeToggle({
  pressed,
  onToggle,
}: {
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="eye"
      aria-pressed={pressed}
      aria-label={pressed ? "Hide password" : "Show password"}
      onClick={onToggle}
    />
  );
}

function PasswordStrengthBlock({
  password,
  email,
}: {
  password: string;
  email?: string;
}) {
  const strength = useMemo(() => analyzePasswordStrength(password, email), [password, email]);
  return (
    <>
      <div
        className="pwm"
        data-level={String(strength.level)}
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.level}
      >
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="pwm-t" aria-live="polite">
        {strength.label}
      </p>
      <ul className="rules" aria-label="Password rules">
        <li className={strength.rules.minLength ? "ok" : ""}>At least 8 characters</li>
        <li className={strength.rules.symbol ? "ok" : ""}>A number or a symbol</li>
        <li className={strength.rules.notEmail ? "ok" : ""}>Not your email</li>
      </ul>
    </>
  );
}

export function PremiumResetPasswordScreen() {
  return <PremiumResetPasswordScreenInner />;
}

function PremiumResetPasswordScreenInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useMemo(() => readResetTokenFromSearch(params.toString()), [params]);

  const [phase, setPhase] = useState<"expired" | "form">(() => (token ? "form" : "expired"));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [pending, setPending] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confError, setConfError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const strength = analyzePasswordStrength(password);
  const mood = strength.level >= 4 ? "happy" : "thinking";
  const line =
    strength.level >= 4
      ? "Nicely done. That one is strong."
      : "Pick something you will remember. Longer is stronger.";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setConfError(null);
    setFormError(null);

    const s = analyzePasswordStrength(password);
    if (!s.rules.minLength) {
      setPwError("Use at least 8 characters.");
      return;
    }
    if (!passwordsMatch(password, confirm)) {
      setConfError("These two do not match. Type the same password in both boxes.");
      return;
    }

    setPending(true);
    const res = await postPasswordReset(token, password);
    setPending(false);
    if (res.ok) {
      router.push("/login");
      return;
    }
    if (res.code === "invalid_link") {
      setPhase("expired");
      return;
    }
    if (res.code === "weak_password") {
      setPwError(res.message);
      return;
    }
    setFormError(res.message);
  }

  if (phase === "expired") {
    return (
      <PremiumAuthDexRoot screen="19b-reset-password" state="expired">
        <PremiumAuthDexLayout
          screen="19b-reset-password"
          state="expired"
          mood="encouraging"
          line="This link timed out. Let me send a new one."
          title="That link has expired"
          muted="Reset links only work for 30 minutes, and only once."
        >
          <div className="alert warn" role="alert">
            <div>Ask for a fresh link and we will send it right away.</div>
          </div>
          <Link className="btn" href="/login/forgot">
            Send me a new link
          </Link>
          <div className="foot">
            <Link className="linkbtn" href="/login">
              Back to sign in
            </Link>
          </div>
        </PremiumAuthDexLayout>
      </PremiumAuthDexRoot>
    );
  }

  return (
    <PremiumAuthDexRoot screen="19b-reset-password" state={strength.level >= 4 ? "strong" : "entry"}>
      <PremiumAuthDexLayout
        screen="19b-reset-password"
        state={strength.level >= 4 ? "strong" : pwError || confError ? "error" : "entry"}
        mood={pwError || confError ? "encouraging" : mood}
        line={
          pwError || confError
            ? "Close. Make both boxes match and try again."
            : line
        }
        title="Choose a new password"
        muted="Pick something you will remember. You will sign in with it next time."
      >
        <form className="form" noValidate onSubmit={(e) => void onSubmit(e)}>
          <div className={`field${pwError ? " bad" : ""}`}>
            <label htmlFor="f-new">New password</label>
            <div className="inp pw">
              <input
                id="f-new"
                name="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="d-f-new"
                aria-invalid={pwError ? true : undefined}
              />
              <EyeToggle pressed={showPw} onToggle={() => setShowPw((v) => !v)} />
            </div>
            <div id="d-f-new" style={{ display: "grid", gap: ".4rem" }}>
              {pwError ? (
                <div className="msg" role="alert">
                  <span>{pwError}</span>
                </div>
              ) : null}
              <PasswordStrengthBlock password={password} />
            </div>
          </div>
          <div className={`field${confError ? " bad" : ""}`}>
            <label htmlFor="f-conf">Confirm new password</label>
            <div className="inp pw">
              <input
                id="f-conf"
                name="confirm"
                type={showConf ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-describedby="d-f-conf"
                aria-invalid={confError ? true : undefined}
              />
              <EyeToggle pressed={showConf} onToggle={() => setShowConf((v) => !v)} />
            </div>
            <div id="d-f-conf" style={{ display: "grid", gap: ".4rem" }}>
              {confError ? (
                <div className="msg" role="alert">
                  <span>{confError}</span>
                </div>
              ) : passwordsMatch(password, confirm) ? (
                <p className="help">Matches.</p>
              ) : null}
            </div>
          </div>
          {formError ? (
            <p className="help" role="alert" style={{ color: "var(--cs-error)" }}>
              {formError}
            </p>
          ) : null}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save new password"}
          </button>
        </form>
        <div className="foot">
          <Link className="linkbtn" href="/login">
            Back to sign in
          </Link>
        </div>
      </PremiumAuthDexLayout>
    </PremiumAuthDexRoot>
  );
}
