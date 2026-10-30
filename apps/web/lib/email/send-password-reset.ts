import "server-only";
import { passwordResetEmail } from "./templates";
import { tryCreateResendTransport, isVercelRuntime } from "./transport";
import type { EmailTransport } from "./transport";
import type { EmailEnv } from "./types";
import { SUPPORT_EMAIL } from "@/lib/support";

const TEST_TRANSPORT_KEY = "__chessSchoolPasswordResetTransport";

type TestTransportSlot = EmailTransport | null | undefined;

function readTestTransportOverride(): TestTransportSlot {
  return (globalThis as Record<string, unknown>)[TEST_TRANSPORT_KEY] as TestTransportSlot;
}

/** In-memory / stub transport — only wired from Vitest (survives vi.resetModules()). */
export function setPasswordResetTransportForTests(
  transport: EmailTransport | null | undefined,
): void {
  (globalThis as Record<string, unknown>)[TEST_TRANSPORT_KEY] = transport;
}

function resolvePasswordResetTransport(env: EmailEnv = process.env): EmailTransport | null {
  const testOverride = readTestTransportOverride();
  if (testOverride !== undefined) {
    return testOverride;
  }
  const onVercel = isVercelRuntime(env);
  const resend = tryCreateResendTransport(env, SUPPORT_EMAIL);
  if (onVercel) return resend;
  if (env.NODE_ENV === "test" && resend) return resend;
  if (env.NODE_ENV === "test") return null;
  return resend;
}

export type PasswordResetMailInput = {
  to: string;
  name: string;
  link: string;
};

/**
 * Send a password-reset email. Returns false when no safe transport is
 * available (never logs the reset link to the console).
 */
export async function sendPasswordResetEmail(
  input: PasswordResetMailInput,
  env: EmailEnv = process.env,
): Promise<boolean> {
  const transport = resolvePasswordResetTransport(env);
  if (!transport) return false;
  try {
    const message = passwordResetEmail(input);
    await transport.send(message);
    return true;
  } catch {
    return false;
  }
}
