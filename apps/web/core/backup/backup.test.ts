import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const gamesToArray = vi.fn();
  const journalToArray = vi.fn();
  const gamesClear = vi.fn();
  const journalClear = vi.fn();
  const gamesBulkPut = vi.fn();
  const journalBulkPut = vi.fn();
  const transaction = vi.fn(async (_mode: string, ...args: unknown[]) => {
    const fn = args[args.length - 1] as () => Promise<void>;
    await fn();
  });
  return {
    gamesToArray,
    journalToArray,
    gamesClear,
    journalClear,
    gamesBulkPut,
    journalBulkPut,
    transaction,
  };
});

vi.mock("@/core/db/db", () => ({
  db: {
    games: {
      toArray: mocks.gamesToArray,
      clear: mocks.gamesClear,
      bulkPut: mocks.gamesBulkPut,
    },
    journal: {
      toArray: mocks.journalToArray,
      clear: mocks.journalClear,
      bulkPut: mocks.journalBulkPut,
    },
    transaction: mocks.transaction,
  },
}));

import {
  exportAll,
  exportToFile,
  importAll,
  storageEstimateKB,
  validateBackup,
  BACKUP_SCHEMA,
} from "./backup";

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

describe("backup export/import", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.gamesToArray.mockResolvedValue([{ id: "g1" }]);
    mocks.journalToArray.mockResolvedValue([{ id: "j1" }]);
    mocks.gamesClear.mockResolvedValue(undefined);
    mocks.journalClear.mockResolvedValue(undefined);
    mocks.gamesBulkPut.mockResolvedValue(undefined);
    mocks.journalBulkPut.mockResolvedValue(undefined);
    mocks.transaction.mockClear();
  });

  it("exports localStorage keys and indexed records", async () => {
    localStorage.setItem("chessschool.settings", JSON.stringify({ sound: true }));
    localStorage.setItem("chessschool.progression", "not-json");

    const data = await exportAll();
    expect(data.app).toBe("chessschool");
    expect(data.schema).toBe(BACKUP_SCHEMA);
    expect(data.localStorage["chessschool.settings"]).toEqual({ sound: true });
    expect(data.localStorage["chessschool.progression"]).toBe("not-json");
    expect(data.games).toHaveLength(1);
    expect(data.journal).toHaveLength(1);
  });

  it("downloads a JSON backup file", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    await exportToFile();
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  it("imports a validated backup into storage", async () => {
    const backup = {
      ...valid,
      localStorage: { "chessschool.settings": { haptics: false } },
      games: [{ id: "g1" }],
      journal: [{ id: "j1" }],
    };
    const result = await importAll(backup);
    expect(result.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem("chessschool.settings")!)).toEqual({
      haptics: false,
    });
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.gamesBulkPut).toHaveBeenCalled();
    expect(mocks.journalBulkPut).toHaveBeenCalled();
  });

  it("estimates storage usage when supported", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 2048 }) },
    });
    await expect(storageEstimateKB()).resolves.toBe(2);
  });
});
