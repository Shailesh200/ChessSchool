import { createClient, type Client } from "@libsql/client";

/** How long a local file connection waits on a lock before SQLITE_BUSY. */
const FILE_BUSY_TIMEOUT_MS = 5000;

function isFileUrl(url: string): boolean {
  return url.startsWith("file:");
}

/**
 * Open a libSQL client. A `file:` database sets `PRAGMA busy_timeout` once on
 * this client so SQLite waits for a lock. `timeout` applies that same wait to
 * every connection the client opens afterwards (`transaction()` replaces the
 * connection, and a PRAGMA does not copy onto the new one). Remote libsql/Turso
 * URLs skip both; the server serializes writes itself.
 */
export function createLibsqlClient(url: string, authToken?: string): Client {
  const file = isFileUrl(url);
  const client = createClient({
    url,
    authToken,
    ...(file ? { timeout: FILE_BUSY_TIMEOUT_MS } : {}),
  });
  if (file) {
    void client
      .execute(`PRAGMA busy_timeout = ${FILE_BUSY_TIMEOUT_MS}`)
      .catch(() => undefined);
  }
  return client;
}
