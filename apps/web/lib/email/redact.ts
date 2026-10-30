/** `jane@example.com` → `j***@example.com`. Unparseable values collapse to `***`. */
export function maskEmailAddress(address: string): string {
  const trimmed = address.replace(/[\r\n]/g, "").trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "***";
  return `${trimmed[0]}***@${trimmed.slice(at + 1)}`;
}

/** Remove a secret if a provider echoes it back in an error string. */
export function redactSecret(value: string, secret: string): string {
  if (!secret) return value;
  return value.split(secret).join("[redacted]");
}

const LOG_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

/** Strip query and hash from a URL; sensitive parts become `?[redacted]`. */
export function redactUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.search && !parsed.hash) return url;
    return `${parsed.origin}${parsed.pathname}?[redacted]`;
  } catch {
    const q = url.indexOf("?");
    const h = url.indexOf("#");
    const cut = Math.min(
      q >= 0 ? q : Number.POSITIVE_INFINITY,
      h >= 0 ? h : Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(cut)) return url;
    return `${url.slice(0, cut)}?[redacted]`;
  }
}

/** Redact query strings and hashes on http(s) URLs embedded in log text. */
export function redactUrlsForLog(text: string): string {
  return text.replace(LOG_URL_PATTERN, (match) => redactUrlForLog(match));
}
