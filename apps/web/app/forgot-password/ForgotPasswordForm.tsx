"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { postPasswordForgot } from "@/lib/auth/passwordReset.client";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const result = await postPasswordForgot(email.trim());
      if (result.ok) {
        setMessage(result.data.message ?? PASSWORD_RESET_GENERIC_MESSAGE);
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  if (message) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink text-sm font-semibold break-words" role="status">
          {message}
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
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-ink-700 text-xs font-extrabold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-card border-hairline bg-surface-card text-ink focus:border-brand h-12 border px-3 text-base font-semibold outline-none"
        />
      </label>
      {error && (
        <p className="rounded-card bg-danger/10 text-danger px-3 py-2 text-sm font-bold break-words">
          {error}
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
