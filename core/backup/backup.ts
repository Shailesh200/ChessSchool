"use client";

import { db, type SavedGame, type JournalEntry } from "@/core/db/db";

/**
 * Local data ownership (#72/#73/#84). Export/import everything as one versioned
 * JSON blob; the schema version lets future builds migrate or reject safely.
 */

export const BACKUP_SCHEMA = 3;

const LS_KEYS = [
  "duochess.settings",
  "duochess.progression",
  "chessschool.plan",
  "chessschool.activematch",
];

export interface BackupFile {
  app: "chessschool";
  schema: number;
  exportedAt: number;
  localStorage: Record<string, unknown>;
  games: SavedGame[];
  journal: JournalEntry[];
}

export async function exportAll(): Promise<BackupFile> {
  const ls: Record<string, unknown> = {};
  for (const k of LS_KEYS) {
    const raw = localStorage.getItem(k);
    if (raw != null) {
      try {
        ls[k] = JSON.parse(raw);
      } catch {
        ls[k] = raw;
      }
    }
  }
  const [games, journal] = await Promise.all([
    db.games.toArray(),
    db.journal.toArray(),
  ]);
  return {
    app: "chessschool",
    schema: BACKUP_SCHEMA,
    exportedAt: Date.now(),
    localStorage: ls,
    games,
    journal,
  };
}

export async function exportToFile(): Promise<void> {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chessschool-backup-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportPreview {
  ok: boolean;
  reason?: string;
  schema?: number;
  games?: number;
  journal?: number;
}

/** Validate a parsed backup before applying (#86 input validation). */
export function validateBackup(value: unknown): ImportPreview {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "Not a JSON object" };
  const b = value as Partial<BackupFile>;
  if (b.app !== "chessschool") return { ok: false, reason: "Not a ChessSchool backup" };
  if (typeof b.schema !== "number") return { ok: false, reason: "Missing schema version" };
  if (b.schema > BACKUP_SCHEMA) return { ok: false, reason: `Newer backup (v${b.schema}) — update the app` };
  if (!Array.isArray(b.games) || !Array.isArray(b.journal)) return { ok: false, reason: "Corrupt records" };
  if (typeof b.localStorage !== "object" || b.localStorage === null) return { ok: false, reason: "Missing settings" };
  return { ok: true, schema: b.schema, games: b.games.length, journal: b.journal.length };
}

/** Replace local data with a validated backup, then the caller reloads. */
export async function importAll(value: unknown): Promise<ImportPreview> {
  const preview = validateBackup(value);
  if (!preview.ok) return preview;
  const b = value as BackupFile;
  for (const [k, v] of Object.entries(b.localStorage)) {
    if (LS_KEYS.includes(k)) localStorage.setItem(k, JSON.stringify(v));
  }
  await db.transaction("rw", db.games, db.journal, async () => {
    await db.games.clear();
    await db.journal.clear();
    if (b.games.length) await db.games.bulkPut(b.games);
    if (b.journal.length) await db.journal.bulkPut(b.journal);
  });
  return preview;
}

export async function storageEstimateKB(): Promise<number | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  return est.usage ? Math.round(est.usage / 1024) : null;
}
