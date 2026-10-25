import type { ErrorInfo, TokenDetails, TokenParams, TokenRequest } from "ably";

/**
 * Ably token auth for one online game.
 *
 * `authHeaders` is captured once and reused on every renewal, so a rotated
 * session token would keep being sent stale. `authCallback` runs on each
 * mint — including renewals — and reads the current bearer via `getToken()`.
 */

type AblyTokenPayload = TokenRequest | TokenDetails;

function isAblyTokenPayload(value: unknown): value is AblyTokenPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type AblyTokenFetch = (
  url: string,
  init: { headers: { authorization: string } },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export type AblyAuthCallback = (
  data: TokenParams,
  callback: (
    error: ErrorInfo | string | null,
    tokenRequestOrDetails: AblyTokenPayload | string | null,
  ) => void,
) => void;

export function ablyTokenUrl(apiUrl: string, gameId: string): string {
  const base = apiUrl.replace(/\/+$/, "");
  return `${base}/api/ably-token?game=${encodeURIComponent(gameId)}`;
}

/** One token mint. Throws when there is no session or the endpoint is not OK. */
export async function fetchAblyTokenRequest(opts: {
  apiUrl: string;
  gameId: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: AblyTokenFetch;
}): Promise<AblyTokenPayload> {
  const sessionToken = await opts.getToken();
  if (!sessionToken) {
    throw new Error("login required");
  }
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(ablyTokenUrl(opts.apiUrl, opts.gameId), {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) {
    throw new Error("ably token request failed");
  }
  const body: unknown = await res.json();
  if (!isAblyTokenPayload(body)) {
    throw new Error("ably token request failed");
  }
  return body;
}

/**
 * Ably `authCallback`. Each call, including token renewal, reads a fresh
 * session token and passes the endpoint JSON (TokenRequest or TokenDetails)
 * through. No token or a non-OK response calls `onAuthError` and the callback
 * with an error so the connection does not stay up on a bad credential.
 */
export function createGameAblyAuth(opts: {
  apiUrl: string;
  gameId: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: AblyTokenFetch;
  onAuthError: () => void;
  isCancelled?: () => boolean;
}): AblyAuthCallback {
  return (_params: TokenParams, callback) => {
    void fetchAblyTokenRequest(opts)
      .then((tokenRequest) => {
        if (opts.isCancelled?.()) {
          callback("cancelled", null);
          return;
        }
        callback(null, tokenRequest);
      })
      .catch((err: unknown) => {
        if (!opts.isCancelled?.()) opts.onAuthError();
        const message = err instanceof Error ? err.message : "ably auth failed";
        callback(message, null);
      });
  };
}

/**
 * Leave realtime and let the poll loop take over. Idempotent so a failed
 * auth callback and the connection `failed` event can both fire it.
 */
export function createAblyPollingFallback(opts: {
  ablyRef: { current: boolean };
  close: () => void;
}): () => void {
  let dropped = false;
  return () => {
    if (dropped) return;
    dropped = true;
    opts.ablyRef.current = false;
    try {
      opts.close();
    } catch {
      /* already closed */
    }
  };
}

/** Connection states where realtime will not deliver moves. */
export const ABLY_DROP_EVENTS = ["failed", "suspended"] as const;
