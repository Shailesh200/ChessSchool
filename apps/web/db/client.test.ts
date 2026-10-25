import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createLibsqlClient } from "./client";

describe("createLibsqlClient", () => {
  it("sets busy_timeout once on a file database", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-busy-"));
    const client = createLibsqlClient(`file:${join(dir, "t.db")}`);
    try {
      const result = await client.execute("PRAGMA busy_timeout");
      const row = result.rows[0] as Record<string, unknown> | undefined;
      const value = row ? Object.values(row)[0] : undefined;
      expect(Number(value)).toBe(5000);
    } finally {
      client.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
