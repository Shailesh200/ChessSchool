import "server-only";
import { envValue, isProduction } from "./env";
import { EmailDeliveryError, EmailNotConfiguredError } from "./errors";
import { maskEmailAddress, redactSecret } from "./redact";
import type { EmailEnv, EmailMessage, EmailProviderName } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;

export type EmailTransport = {
  name: EmailProviderName;
  send(message: EmailMessage): Promise<{ id: string | null }>;
};

/** Console is fine except real production. See {@link isProduction}. */
function consoleFallbackAllowed(env: EmailEnv): boolean {
  return !isProduction(env);
}

function logConsoleEmail(message: EmailMessage): void {
  // Mask the recipient. Leave text intact so preview and e2e can follow the link.
  console.info(
    `[email] console transport ${JSON.stringify({
      to: maskEmailAddress(message.to),
      subject: message.subject,
      text: message.text,
    })}`,
  );
}

function createConsoleTransport(): EmailTransport {
  return {
    name: "console",
    async send(message) {
      logConsoleEmail(message);
      return { id: null };
    },
  };
}

function deliveryFailure(err: unknown): string {
  const named =
    (typeof DOMException !== "undefined" && err instanceof DOMException) ||
    err instanceof Error
      ? err
      : null;
  if (named?.name === "TimeoutError" || named?.name === "AbortError") {
    return "request timed out";
  }
  return named instanceof Error ? named.message : "network error";
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  try {
    const data = JSON.parse(text) as { message?: unknown };
    if (typeof data.message === "string") return data.message.slice(0, 300);
  } catch {
    /* non-JSON body */
  }
  return "";
}

function createResendTransport(apiKey: string, from: string): EmailTransport {
  return {
    name: "resend",
    async send(message) {
      let res: Response;
      try {
        res = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        });
      } catch (err) {
        throw new EmailDeliveryError(
          `Resend email failed: ${redactSecret(deliveryFailure(err), apiKey)}`,
        );
      }

      if (!res.ok) {
        const detail = redactSecret(await readErrorMessage(res), apiKey);
        throw new EmailDeliveryError(
          `Resend email failed (${res.status})${detail ? `: ${detail}` : ""}`,
        );
      }

      let id: string | null = null;
      try {
        const data = (await res.json()) as { id?: unknown };
        if (typeof data.id === "string" && data.id) id = data.id;
      } catch {
        id = null;
      }
      return { id };
    },
  };
}

function failClosed(provider: string, resendSelected: boolean): never {
  if (resendSelected) {
    throw new EmailNotConfiguredError(
      "Resend is not fully configured. Set RESEND_API_KEY and EMAIL_FROM (EMAIL_PROVIDER=resend).",
    );
  }
  if (provider && provider !== "console") {
    throw new EmailNotConfiguredError(
      `Email provider "${provider}" is not supported. Set EMAIL_PROVIDER=resend, RESEND_API_KEY, and EMAIL_FROM.`,
    );
  }
  throw new EmailNotConfiguredError(
    "No transactional email provider is configured. Set EMAIL_PROVIDER=resend, RESEND_API_KEY, and EMAIL_FROM.",
  );
}

/**
 * Resend when EMAIL_PROVIDER=resend and both RESEND_API_KEY and EMAIL_FROM are set.
 * Otherwise the console transport, including Vercel preview. Real production
 * fails closed even when CI is set.
 */
export function resolveEmailTransport(env: EmailEnv = process.env): EmailTransport {
  const provider = envValue(env.EMAIL_PROVIDER).toLowerCase();
  const apiKey = envValue(env.RESEND_API_KEY);
  const from = envValue(env.EMAIL_FROM);
  const resendSelected = provider === "resend";
  const resendReady = resendSelected && apiKey !== "" && from !== "";

  if (resendReady) return createResendTransport(apiKey, from);

  if (!consoleFallbackAllowed(env)) failClosed(provider, resendSelected);

  if (resendSelected) {
    console.warn(
      "[email] Resend is missing RESEND_API_KEY or EMAIL_FROM; using console transport",
    );
  } else if (provider && provider !== "console") {
    console.warn(
      `[email] unsupported EMAIL_PROVIDER=${provider}; using console transport`,
    );
  }

  return createConsoleTransport();
}
