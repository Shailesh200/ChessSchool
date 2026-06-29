import { describe, it, expect } from "vitest";
import { validateBackup, BACKUP_SCHEMA } from "./backup";

const valid = {
  app: "chessschool",
  schema: BACKUP_SCHEMA,
  exportedAt: 0,
  localStorage: {},
  games: [],
  journal: [],
};

describe("backup validation", () => {
  it("accepts a well-formed backup", () => {
    const r = validateBackup(valid);
    expect(r.ok).toBe(true);
    expect(r.games).toBe(0);
  });

  it("rejects foreign or malformed files", () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: "other" }).ok).toBe(false);
    expect(validateBackup({ ...valid, games: "nope" }).ok).toBe(false);
    expect(validateBackup({ ...valid, localStorage: null }).ok).toBe(false);
  });

  it("refuses a newer schema than this build understands", () => {
    expect(validateBackup({ ...valid, schema: BACKUP_SCHEMA + 1 }).ok).toBe(false);
  });
});
