"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  PremiumAuthDexLayout,
  PremiumAuthDexRoot,
} from "@/features/premium-ui/auth/PremiumAuthDexLayout";
import {
  requestPasswordReset,
  resendPasswordReset,
} from "@/lib/auth/passwordReset.client";

type View = "entry" | "sent" | "error";

export function PremiumForgotPasswordScreen() {
  const [view, setView] = useState<View>("entry");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [sentEmail, setSentEmail] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const submit = useCallback(async () => {
    setPending(true);
    setFieldError(null);
    const res = await requestPasswordReset(email);
    setPending(false);
    if (!res.ok) {
      if (res.code === "invalid_email") {
        setFieldError(res.message);
        setView("error");
        return;
      }
      setFieldError(res.message);
      setView("error");
      return;
    }
    setSentEmail(email.trim());
    setView("sent");
    setResendIn(30);
  }, [email]);

  const resend = useCallback(async () => {
    if (resendIn > 0 || !sentEmail) return;
    setPending(true);
    await resendPasswordReset(sentEmail);
    setPending(false);
    setResendIn(30);
  }, [resendIn, sentEmail]);

  if (view === "sent") {
    return (
      <PremiumAuthDexRoot screen="19a-forgot-password" state="sent">
        <PremiumAuthDexLayout
          screen="19a-forgot-password"
          state="sent"
          mood="happy"
          bodyAccent="celebrating"
          line="Link's on its way. Check your inbox."
          title="Check your email"
        >
          <div className="sentbox" role="status">
            <span className="mi" aria-hidden="true">
              ✉
            </span>
            <p>
              We sent a reset link to <b>{sentEmail}</b>.
            </p>
            <p className="help">The link works for 30 minutes. Nothing there? Check spam.</p>
          </div>
          <button type="button" className="btn line" disabled={pending || resendIn > 0} onClick={() => void resend()}>
            Resend link
          </button>
          <p className="help" style={{ textAlign: "center" }}>
            {resendIn > 0
              ? `You can ask for another link in ${resendIn} seconds.`
              : "Didn't get it? Tap resend."}
          </p>
          <div className="foot">
            <Link className="linkbtn" href="/login">
              Back to sign in
            </Link>
          </div>
        </PremiumAuthDexLayout>
      </PremiumAuthDexRoot>
    );
  }

  const mood = view === "error" ? "encouraging" : "neutral";
  const line =
    view === "error"
      ? "Almost. Check the email and try once more."
      : "No stress. Tell me your email and I'll send a link.";

  return (
    <PremiumAuthDexRoot screen="19a-forgot-password" state={view === "error" ? "error" : "entry"}>
      <PremiumAuthDexLayout
        screen="19a-forgot-password"
        state={view === "error" ? "error" : "entry"}
        mood={mood}
        line={line}
        title="Forgot your password?"
        muted="Tell us your email. We will send you a link to choose a new one."
      >
        <form
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className={`field${fieldError ? " bad" : ""}`}>
            <label htmlFor="f-email">Email</label>
            <div className="inp">
              <input
                id="f-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError(null);
                  if (view === "error") setView("entry");
                }}
                autoComplete="email"
                aria-describedby="d-f-email"
                aria-invalid={fieldError ? true : undefined}
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div id="d-f-email" style={{ display: "grid", gap: ".4rem" }}>
              {fieldError ? (
                <div className="msg" role="alert">
                  <span>{fieldError}</span>
                </div>
              ) : (
                <p className="help">The email you signed up with.</p>
              )}
            </div>
          </div>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
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
