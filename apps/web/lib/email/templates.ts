import "server-only";
import type { EmailMessage } from "./types";

const PRODUCT_NAME = "Chess School";

export type PasswordResetEmailInput = {
  to: string;
  /** Shown in the greeting. Escaped in HTML; plain in the text part. */
  name: string;
  /**
   * Absolute reset URL built by the caller.
   * Put the token in the hash fragment (`#`), never the query string.
   */
  link: string;
};

export type VerifyEmailInput = {
  to: string;
  /** Shown in the greeting. Escaped in HTML; plain in the text part. */
  name: string;
  /**
   * Absolute verification URL built by the caller.
   * Put the token in the hash fragment (`#`), never the query string.
   */
  link: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function displayName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  return trimmed || "there";
}

function requireLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) throw new Error("Email link is required.");
  return trimmed;
}

type TemplateCopy = {
  subject: string;
  name: string;
  intro: string;
  actionLabel: string;
  link: string;
  outro: string;
};

function buildMessage(to: string, copy: TemplateCopy): EmailMessage {
  const name = displayName(copy.name);
  const text = [
    `Hi ${name},`,
    "",
    copy.intro,
    "",
    `${copy.actionLabel}:`,
    copy.link,
    "",
    copy.outro,
    "",
    `— ${PRODUCT_NAME}`,
  ].join("\n");

  const safeName = escapeHtml(name);
  const safeIntro = escapeHtml(copy.intro);
  const safeAction = escapeHtml(copy.actionLabel);
  const safeLink = escapeHtml(copy.link);
  const safeOutro = escapeHtml(copy.outro);

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f3ee;color:#1c1917;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:24px;border-radius:12px;">
      <p style="margin:0 0 12px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;line-height:1.5;">${safeIntro}</p>
      <p style="margin:0 0 16px;">
        <a href="${safeLink}" style="display:inline-block;background:#1c1917;color:#faf7f2;text-decoration:none;padding:10px 16px;border-radius:8px;">${safeAction}</a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#57534e;">Or copy this link:<br />${safeLink}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#57534e;">${safeOutro}</p>
      <p style="margin:0;font-size:14px;">— ${PRODUCT_NAME}</p>
    </div>
  </body>
</html>`;

  return {
    to: to.trim(),
    subject: copy.subject,
    text,
    html,
  };
}

/** Password-reset message. The caller owns the link and the token in its fragment. */
export function passwordResetEmail(input: PasswordResetEmailInput): EmailMessage {
  return buildMessage(input.to, {
    subject: `Reset your ${PRODUCT_NAME} password`,
    name: input.name,
    intro: `We received a request to reset the password for your ${PRODUCT_NAME} account.`,
    actionLabel: "Reset your password",
    link: requireLink(input.link),
    outro: "If you didn't ask for this, you can ignore this email.",
  });
}

/** Email-verification message. The caller owns the link and the token in its fragment. */
export function verifyEmailMessage(input: VerifyEmailInput): EmailMessage {
  return buildMessage(input.to, {
    subject: `Verify your ${PRODUCT_NAME} email`,
    name: input.name,
    intro: `Confirm this address to finish setting up your ${PRODUCT_NAME} account.`,
    actionLabel: "Verify your email",
    link: requireLink(input.link),
    outro: `If you didn't create a ${PRODUCT_NAME} account, you can ignore this email.`,
  });
}
