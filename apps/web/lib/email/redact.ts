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
