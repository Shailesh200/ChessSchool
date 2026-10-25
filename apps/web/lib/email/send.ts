import "server-only";
import { resolveEmailTransport } from "./transport";
import type { EmailMessage, SendEmailResult } from "./types";

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function assertMessage(message: EmailMessage): EmailMessage {
  const to = singleLine(message.to ?? "");
  const subject = singleLine(message.subject ?? "");
  const text = message.text ?? "";
  const html = message.html ?? "";
  if (!to || !to.includes("@")) throw new Error("Email recipient is required.");
  if (!subject) throw new Error("Email subject is required.");
  if (!text.trim() && !html.trim()) throw new Error("Email body is required.");
  return { to, subject, text, html };
}

/**
 * Send one transactional email.
 * Outside production, a missing provider logs a redacted copy.
 * Production throws EmailNotConfiguredError instead of logging, even when CI is set.
 */
export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const safe = assertMessage(message);
  const transport = resolveEmailTransport();
  const result = await transport.send(safe);
  return { provider: transport.name, id: result.id };
}
