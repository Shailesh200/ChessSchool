"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

function readHashToken(): string | null {
  const hash = window.location.hash.replace(/^#/, "").trim();
  return hash || null;
}

function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    ResetPasswordState | undefined,
    FormData
  >(resetPasswordAction, undefined);
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1">
        <span className="text-ink-700 text-xs font-extrabold">New password</span>
        <div className="relative">
          <input
            name="password"
            type={visible ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-card border-hairline bg-surface-card text-ink focus:border-brand h-12 w-full border px-3 pr-11 text-base font-semibold outline-none"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="btn-tactile text-ink-500 hover:text-ink absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            <Icon name={visible ? "eyeOff" : "eye"} size={20} />
          </button>
        </div>
      </label>
      {state?.error && (
        <p className="rounded-card bg-danger/10 text-danger px-3 py-2 text-sm font-bold break-words">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Please wait…" : "Save new password"}
      </Button>
      <p className="text-ink-500 text-sm font-semibold break-words">
        <Link href="/login" className="text-brand font-extrabold">
          ← Back to log in
        </Link>
      </p>
    </form>
  );
}

/** Reads the reset token from the URL hash (matches password-reset email links). */
export function AccountResetClient() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const token = useSyncExternalStore(
    () => () => {},
    readHashToken,
    () => null,
  );

  if (!hydrated) {
    return <div className="mt-6 min-h-48" aria-hidden />;
  }

  if (!token) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-ink-500 text-sm font-semibold break-words">
          This reset link is invalid or has expired. Request a new link from the forgot password
          page.
        </p>
        <Link href="/forgot-password" className="text-brand font-extrabold text-sm">
          Request a new link
        </Link>
        <Link href="/login" className="text-brand font-extrabold text-sm">
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-ink-500 mt-3 text-sm font-semibold break-words">
        Use at least 8 characters. After you save, sign in with your new password.
      </p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </>
  );
}
