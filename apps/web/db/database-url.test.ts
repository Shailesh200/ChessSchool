import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_DATABASE_URL,
  isHostedDatabaseUrl,
  isRemoteDriverUrl,
  requiresHostedDatabase,
  resolveDatabaseUrl,
} from "./database-url";

const SECRET_URL = "file:/tmp/do-not-leak-database-url";
const SECRET_TOKEN = "do-not-leak-auth-token-value";

describe("resolveDatabaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the local file when DATABASE_URL is unset", () => {
    expect(resolveDatabaseUrl({})).toBe(LOCAL_DATABASE_URL);
    expect(resolveDatabaseUrl({ DATABASE_URL: "" })).toBe(LOCAL_DATABASE_URL);
    expect(resolveDatabaseUrl({ DATABASE_URL: "   " })).toBe(LOCAL_DATABASE_URL);
  });

  it("keeps the file fallback for local production builds and CI", () => {
    expect(resolveDatabaseUrl({ NODE_ENV: "production" })).toBe(LOCAL_DATABASE_URL);
    expect(requiresHostedDatabase({})).toBe(false);
    expect(requiresHostedDatabase({ VERCEL: "" })).toBe(false);
  });

  it("preserves explicit local schemes and prefixes bare paths", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "file:custom.db" })).toBe(
      "file:custom.db",
    );
    expect(resolveDatabaseUrl({ DATABASE_URL: "  file:custom.db  " })).toBe(
      "file:custom.db",
    );
    expect(resolveDatabaseUrl({ DATABASE_URL: "local.db" })).toBe("file:local.db");
    expect(resolveDatabaseUrl({ DATABASE_URL: "/tmp/chess.db" })).toBe(
      "file:/tmp/chess.db",
    );
    expect(resolveDatabaseUrl({ DATABASE_URL: "http://127.0.0.1:8080" })).toBe(
      "http://127.0.0.1:8080",
    );
  });

  it("passes through hosted URLs locally", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "libsql://db.turso.io" })).toBe(
      "libsql://db.turso.io",
    );
    expect(resolveDatabaseUrl({ DATABASE_URL: " https://db.turso.io " })).toBe(
      "https://db.turso.io",
    );
    expect(isHostedDatabaseUrl("libsql://db.turso.io")).toBe(true);
    expect(isHostedDatabaseUrl("https://db.turso.io")).toBe(true);
    expect(isHostedDatabaseUrl("http://127.0.0.1:8080")).toBe(false);
    expect(isRemoteDriverUrl("http://127.0.0.1:8080")).toBe(true);
    expect(isRemoteDriverUrl("file:local.db")).toBe(false);
  });

  it("reads process.env when no env object is passed", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "file:from-env.db");
    expect(resolveDatabaseUrl()).toBe("file:from-env.db");
  });

  it("throws when VERCEL is set and DATABASE_URL is missing", () => {
    expect(requiresHostedDatabase({ VERCEL: "1" })).toBe(true);
    for (const DATABASE_URL of [undefined, "", "   "]) {
      let message = "";
      expect(() => {
        try {
          resolveDatabaseUrl({ VERCEL: "1", DATABASE_URL });
        } catch (error) {
          message = error instanceof Error ? error.message : String(error);
          throw error;
        }
      }).toThrow(/DATABASE_URL/);
      expect(message).toMatch(/libsql:/);
      expect(message).toMatch(/https:/);
      expect(message).not.toContain(SECRET_TOKEN);
    }
  });

  it("throws when VERCEL is set and the URL is not libsql: or https:", () => {
    const rejected = [
      SECRET_URL,
      "local.db",
      "http://db.turso.io",
      "LIBSQL://db.turso.io",
      "file:local.db",
    ];
    for (const DATABASE_URL of rejected) {
      let message = "";
      expect(() => {
        try {
          resolveDatabaseUrl({
            VERCEL: "1",
            DATABASE_URL,
            DATABASE_AUTH_TOKEN: SECRET_TOKEN,
          });
        } catch (error) {
          message = error instanceof Error ? error.message : String(error);
          throw error;
        }
      }).toThrow(/DATABASE_URL/);
      expect(message).toMatch(/libsql:/);
      expect(message).not.toContain(DATABASE_URL.trim());
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).not.toContain("DATABASE_AUTH_TOKEN=");
    }
  });

  it("accepts a hosted URL on Vercel and ignores a local-db opt-in", () => {
    expect(
      resolveDatabaseUrl({
        VERCEL: "1",
        DATABASE_URL: "  libsql://prod.turso.io  ",
        ALLOW_LOCAL_DB: "1",
        NODE_ENV: "production",
      }),
    ).toBe("libsql://prod.turso.io");
    expect(
      resolveDatabaseUrl({
        VERCEL: "1",
        NODE_ENV: "production",
        DATABASE_URL: "https://prod.turso.io",
      }),
    ).toBe("https://prod.turso.io");
  });
});
