"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PULSE_PENDING_AUTH } from "@/lib/pulse";

type Action = (
  prev: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string }>;

const OTTO_LINE = "Welcome back! Ready for one small win today?";

export function PremiumAuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const searchParams = useSearchParams();
  const next =
    searchParams.get("next") ?? (mode === "register" ? "/onboarding" : "/welcome");
  const isRegister = mode === "register";
  const [showPw, setShowPw] = useState(false);

  return (
    <div id="root" className="dex-screen" data-screen="16-auth">
      <div className="authwrap" data-center="">
        <main className="authcol" id="main" tabIndex={-1}>
          <div
            className="gframe logo"
            style={{
              ["--g1" as string]: "#E3F5EC",
              ["--g2" as string]: "#B5E1CC",
              ["--acc" as string]: "var(--acc-brand)",
            }}
          >
            <span className="logo-h" role="img" aria-label="ChessSchool" />
          </div>
          <div className="coachrow">
            <span
              className="head"
              style={{ ["--art" as string]: "var(--head-otto-happy)", ["--s" as string]: "4rem" }}
              role="img"
              aria-label="Otto"
            />
            <div className="bub" aria-live="polite">
              <div className="say">
                <span>{isRegister ? "Let's make your student account." : OTTO_LINE}</span>
              </div>
            </div>
          </div>
          <h1>{isRegister ? "Create account" : "Sign in"}</h1>
          <p className="muted">{isRegister ? "Save progress on every device." : "Pick up where you left off."}</p>

          <GoogleSignInButton next={next} />

          <div className="divider" aria-hidden="true">
            or
          </div>

          <form
            className="form"
            action={formAction}
            onSubmit={() => {
              try {
                sessionStorage.setItem(
                  PULSE_PENDING_AUTH,
                  isRegister ? "signup" : "login",
                );
              } catch {
                /* private mode */
              }
            }}
          >
            {isRegister && (
              <div className="field">
                <label htmlFor="f-name">Full name</label>
                <div className="inp">
                  <input id="f-name" name="name" type="text" autoComplete="name" required />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor="f-email">Email</label>
              <div className="inp">
                <input
                  id="f-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>
              <p className="help">For example: name@example.com</p>
            </div>
            <div className="field">
              <label htmlFor="f-pw">Password</label>
              <div className="inp pw">
                <input
                  id="f-pw"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="eye"
                  aria-pressed={showPw}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((v) => !v)}
                />
              </div>
            </div>
            {!isRegister && (
              <div style={{ textAlign: "right" }}>
                <Link className="linkbtn" href="/forgot-password">
                  Forgot password?
                </Link>
              </div>
            )}
            {state?.error && (
              <p className="help" style={{ color: "var(--cs-error)" }}>
                {state.error}
              </p>
            )}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <Link className="btn line" href="/academy">
            Continue as guest
          </Link>
          <p className="help" style={{ textAlign: "center" }}>
            Your progress stays on this device until you enroll.
          </p>
          <div className="foot">
            <span>{isRegister ? "Already enrolled?" : "New here?"}</span>
            <Link className="linkbtn" href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

export function PremiumAuthErrorBanner({ message }: { message: string }) {
  return (
    <div className="card" role="alert" style={{ borderColor: "var(--cs-error)" }}>
      <p>{message}</p>
    </div>
  );
}
