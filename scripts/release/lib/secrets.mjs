/**
 * Secret-pattern scan helpers. Never return matched secret values — only file + line.
 */

const RULES = [
  {
    name: "private-key",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "stripe-live",
    re: /\bsk_live_[0-9a-zA-Z]{16,}\b/,
  },
  {
    name: "aws-access-key",
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "github-token",
    re: /\b(?:ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/,
  },
  {
    name: "database-auth-token",
    re: /\bDATABASE_AUTH_TOKEN\s*=\s*['"]?[A-Za-z0-9_+/=-]{20,}/,
  },
  {
    name: "turso-jwt",
    re: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  },
];

const STATIC_FORBIDDEN = [
  { name: "turso-env-name", re: /\bTURSO_/ },
  { name: "database-auth-token-name", re: /\bDATABASE_AUTH_TOKEN\b/ },
  { name: "libsql-url", re: /\blibsql:\/\// },
];

/**
 * @param {string} path
 */
export function isTestLikePath(path) {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /\.test\.mjs$/.test(path) ||
    path.includes(".integration.test.") ||
    /(?:^|\/)__tests__(?:\/|$)/.test(path)
  );
}

/**
 * @param {string} path
 */
export function isDisallowedEnvFile(path) {
  const base = path.split("/").pop() ?? path;
  if (!base.startsWith(".env")) return false;
  if (base === ".env.example") return false;
  return true;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function secretRuleNamesMatchingLine(line) {
  const names = [];
  for (const rule of RULES) {
    if (rule.re.test(line)) names.push(rule.name);
  }
  return names;
}

/**
 * @param {string} line
 */
export function staticBundleForbiddenNames(line) {
  const names = [];
  for (const rule of STATIC_FORBIDDEN) {
    if (rule.re.test(line)) names.push(rule.name);
  }
  return names;
}

/**
 * @param {{ path: string, lines: string[] }} file
 * @returns {{ path: string, line: number, rule: string }[]}
 */
export function scanFileContent(file) {
  const findings = [];
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i];
    for (const rule of secretRuleNamesMatchingLine(line)) {
      findings.push({ path: file.path, line: i + 1, rule });
    }
  }
  return findings;
}

/**
 * @param {string} text
 */
export function formatFinding(path, line, rule) {
  return `${path}:${line}: ${rule}`;
}
