/** Drop URLs so logs cannot contain reset/verify tokens or full links. */
export function redactUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"')\]]+/gi, "[link]");
}

/** Remove a secret if a provider echoes it back in an error string. */
export function redactSecret(value: string, secret: string): string {
  if (!secret) return value;
  return value.split(secret).join("[redacted]");
}
