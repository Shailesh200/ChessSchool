import { Share } from "react-native";
import { progressStore } from "./progressStore";
import { settings } from "./settings";
import { getActiveBotMatch } from "./matchStore";

export const BACKUP_SCHEMA = 3;

export type BackupFile = {
  app: "chessschool";
  schema: number;
  exportedAt: number;
  localStorage: Record<string, unknown>;
  games: unknown[];
  journal: unknown[];
};

export type ImportPreview = {
  ok: boolean;
  reason?: string;
  schema?: number;
  games?: number;
  journal?: number;
};

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

export async function exportBackup(): Promise<BackupFile> {
  const snap = progressStore.get() ?? {};
  return {
    app: "chessschool",
    schema: BACKUP_SCHEMA,
    exportedAt: Date.now(),
    localStorage: {
      "chessschool.settings": settings.get(),
      "chessschool.progression": snap,
      "chessschool.activematch": getActiveBotMatch(),
    },
    games: (snap.recentGames as unknown[]) ?? [],
    journal: (snap.journalEntries as unknown[]) ?? [],
  };
}

export async function exportBackupToFile(): Promise<void> {
  const data = await exportBackup();
  const json = JSON.stringify(data, null, 2);
  const name = `chessschool-backup-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`;
  await Share.share({ message: json, title: name });
}

export async function importBackup(value: unknown): Promise<ImportPreview> {
  const preview = validateBackup(value);
  if (!preview.ok) return preview;
  const b = value as BackupFile;

  const ls = b.localStorage;
  if (ls["chessschool.settings"] && typeof ls["chessschool.settings"] === "object") {
    const { hydrateSettings } = await import("./settings");
    hydrateSettings(ls["chessschool.settings"] as never);
  }

  const progression = ls["chessschool.progression"];
  if (progression && typeof progression === "object") {
    const merged = {
      ...(progression as Record<string, unknown>),
      recentGames: b.games,
      journalEntries: b.journal,
    };
    const { mutateProgress } = await import("./progressStore");
    await mutateProgress(() => merged);
  }

  return preview;
}

export function storageEstimateKB(): number | null {
  try {
    const snap = progressStore.get();
    const raw = JSON.stringify(snap ?? {});
    return Math.max(1, Math.round(raw.length / 1024));
  } catch {
    return null;
  }
}
