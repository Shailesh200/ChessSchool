"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  requestForgotPasswordAction,
  type ForgotPasswordState,
} from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState | undefined,
    FormData
  >(requestForgotPasswordAction, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink text-sm font-semibold break-words" role="status">
          {state.message}
        </p>
        <p className="text-ink-500 text-sm font-semibold break-words">
          Check your inbox and spam folder. Links expire after about an hour.
        </p>
        <Link href="/login" className="text-brand font-extrabold text-sm">
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-ink-700 text-xs font-extrabold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-card border-hairline bg-surface-card text-ink focus:border-brand h-12 border px-3 text-base font-semibold outline-none"
        />
      </label>
      {state?.error && (
        <p className="rounded-card bg-danger/10 text-danger px-3 py-2 text-sm font-bold break-words">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Please wait…" : "Send reset link"}
      </Button>
      <p className="text-ink-500 text-sm font-semibold break-words">
        Signed up with Google? Use Continue with Google on the{" "}
        <Link href="/login" className="text-brand font-extrabold">
          login page
        </Link>
        — there may be no password to reset.
      </p>
      <p className="text-ink-500 text-sm font-semibold break-words">
        <Link href="/login" className="text-brand font-extrabold">
          ← Back to log in
        </Link>
      </p>
    </form>
  );
}
