/** Pure validation for 19a / 19b — safe to unit test without React Native. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ForgotEmailError = "incomplete" | "invalid";

export function validateForgotEmail(raw: string): { ok: true; email: string } | { ok: false; error: ForgotEmailError; message: string } {
  const email = raw.trim();
  if (!email.includes("@") || !email.includes(".")) {
    return {
      ok: false,
      error: "incomplete",
      message: "That email looks incomplete. Add the part after the @, like name@example.com.",
    };
  }
  if (!EMAIL_RE.test(email)) {
    return {
      ok: false,
      error: "invalid",
      message: "That email looks incomplete. Add the part after the @, like name@example.com.",
    };
  }
  return { ok: true, email };
}

export type PasswordRuleId = "length" | "symbol" | "notEmail";

export type PasswordCheck = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  rules: Record<PasswordRuleId, boolean>;
  minOk: boolean;
};

export function checkPasswordStrength(password: string, email = ""): PasswordCheck {
  const emailLocal = email.trim().toLowerCase().split("@")[0] ?? "";
  const rules: Record<PasswordRuleId, boolean> = {
    length: password.length >= 8,
    symbol: /[0-9]|[^A-Za-z0-9]/.test(password),
    notEmail: !emailLocal || password.toLowerCase() !== emailLocal,
  };
  let score = 0;
  if (rules.length) score++;
  if (rules.symbol) score++;
  if (password.length >= 12) score++;
  if (rules.length && rules.symbol && rules.notEmail && password.length >= 10) score = 4;

  const level = Math.min(4, Math.max(0, score)) as PasswordCheck["level"];

  let label = "Start typing to see how strong it is.";
  if (password.length === 0) label = "Start typing to see how strong it is.";
  else if (!rules.length) label = "Too short.";
  else if (level === 4) label = "Strong. Nice one.";
  else if (level >= 3) label = "Good so far.";
  else if (level >= 2) label = "Getting there.";
  else label = "Too short.";

  return {
    level,
    label,
    rules,
    minOk: rules.length && rules.symbol && rules.notEmail,
  };
}

export function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}

export const RESEND_COOLDOWN_SEC = 30;
