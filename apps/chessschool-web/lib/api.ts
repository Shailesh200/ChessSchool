import { ApiError, copy, createApiClient, type ApiErrorCode } from "@chessschool/design";

/** Same-origin: next.config rewrites /v1/* to the API so the session cookie is first-party. */
export const api = createApiClient({ baseUrl: "" });

const messages: Partial<Record<ApiErrorCode, string>> = {
  invalid_credentials: copy.auth.errors.credentials,
  email_taken: copy.auth.errors.emailTaken,
  google_only: copy.auth.errors.googleOnly,
  google_invalid: copy.auth.errors.generic,
  google_unconfigured: copy.auth.googleUnavailable,
  rate_limited: copy.auth.errors.rateLimited,
  offline: copy.auth.errors.offline,
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return messages[err.code] ?? (err.status >= 500 || err.status === 0 ? copy.auth.errors.offline : copy.auth.errors.generic);
  return copy.auth.errors.generic;
}
