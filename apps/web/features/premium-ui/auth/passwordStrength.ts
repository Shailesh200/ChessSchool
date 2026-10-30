export type PasswordRuleState = { minLength: boolean; symbol: boolean; notEmail: boolean };

export type PasswordStrength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  rules: PasswordRuleState;
};

export function analyzePasswordStrength(password: string, email?: string): PasswordStrength {
  const rules: PasswordRuleState = {
    minLength: password.length >= 8,
    symbol: /[0-9]|[^A-Za-z0-9]/.test(password),
    notEmail: !email || password.trim().toLowerCase() !== email.trim().toLowerCase(),
  };

  if (!password) {
    return { level: 0, label: "Start typing to see how strong it is.", rules };
  }
  if (!rules.minLength) {
    return { level: 1, label: "Too short.", rules };
  }

  let score = 1;
  if (rules.symbol) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;

  const level = Math.min(4, Math.max(2, score)) as 1 | 2 | 3 | 4;
  if (level >= 4) return { level: 4, label: "Strong. Nice one.", rules };
  if (level === 3) return { level: 3, label: "Good so far.", rules };
  return { level: 2, label: "Keep going.", rules };
}

export function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}
