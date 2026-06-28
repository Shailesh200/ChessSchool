"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

type Action = (
  prev: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string }>;

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isRegister = mode === "register";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="mt-2 text-2xl font-extrabold text-ink">
            {isRegister ? "Enroll at ChessSchool" : "Welcome back"}
          </h1>
          <p className="text-sm font-semibold text-ink-500">
            {isRegister
              ? "Create your student account to save progress and earn your ID."
              : "Log in to continue your studies."}
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          {isRegister && (
            <Field label="Full name" name="name" type="text" autoComplete="name" />
          )}
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
          />

          {state?.error && (
            <p className="rounded-card bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" size="lg" block disabled={pending} className="mt-1">
            {pending ? "Please wait…" : isRegister ? "Enroll" : "Log in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm font-semibold text-ink-500">
          {isRegister ? "Already enrolled? " : "New here? "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="font-extrabold text-brand"
          >
            {isRegister ? "Log in" : "Enroll now"}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs font-semibold text-ink-300">
          <Link href="/">Continue as guest →</Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold text-ink-700">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="h-12 rounded-card border border-hairline bg-surface-card px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
      />
    </label>
  );
}
