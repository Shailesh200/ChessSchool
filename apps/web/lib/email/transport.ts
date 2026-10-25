import "server-only";
import { EmailDeliveryError, EmailNotConfiguredError } from "./errors";
import { redactSecret, redactUrls } from "./redact";
import type { EmailEnv, EmailMessage, EmailProviderName } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailTransport = {
  name: EmailProviderName;
  send(message: EmailMessage): Promise<{ id: string | null }>;
};

function trimmed(value: string | undefined): string {
  return value?.replace(/[\r\n]/g, "").trim() ?? "";
}

/** Dev, test, and CI may log instead of sending when no real provider is configured. */
function consoleFallbackAllowed(env: EmailEnv): boolean {
  const ci = trimmed(env.CI);
  if (ci === "true" || ci === "1") return true;
  const nodeEnv = trimmed(env.NODE_ENV);
  if (nodeEnv === "development" || nodeEnv === "test") return true;
  return nodeEnv !== "production";
}

function logConsoleEmail(message: EmailMessage, env: EmailEnv): void {
  const redacted = {
    to: message.to,
    subject: redactUrls(message.subject),
    text: redactUrls(message.text),
  };
  console.info(`[email] console transport ${JSON.stringify(redacted)}`);
  // Local dev only: the link (and its fragment token) is on debug, never info.
  if (trimmed(env.NODE_ENV) === "development") {
    console.debug(
      `[email] development copy ${JSON.stringify({
        to: message.to,
        subject: message.subject,
        text: message.text,
      })}`,
    );
  }
}

function createConsoleTransport(env: EmailEnv): EmailTransport {
  return {
    name: "console",
    async send(message) {
      logConsoleEmail(message, env);
      return { id: null };
    },
  };
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
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : "network error";
        throw new EmailDeliveryError(
          `Resend email failed: ${redactSecret(reason, apiKey)}`,
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
 * Otherwise the console transport in dev, test, and CI. Production fails closed.
 */
export function resolveEmailTransport(env: EmailEnv = process.env): EmailTransport {
  const provider = trimmed(env.EMAIL_PROVIDER).toLowerCase();
  const apiKey = trimmed(env.RESEND_API_KEY);
  const from = trimmed(env.EMAIL_FROM);
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

  return createConsoleTransport(env);
}
