import type { ListQuery, MetadataStore, OtaRecord } from "./types";

const matches = (r: OtaRecord, q: ListQuery) =>
  (!q.channel || r.channel === q.channel) &&
  (!q.runtimeVersion || r.runtimeVersion === q.runtimeVersion || r.runtimeVersion === "*") &&
  (!q.platform || r.platform === q.platform || r.platform === "*");

const newestFirst = (a: OtaRecord, b: OtaRecord) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

/** Keeps everything in memory. For tests and local experiments. */
export function memoryMetadata(): MetadataStore {
  const rows = new Map<string, OtaRecord>();
  return {
    async add(r) {
      rows.set(r.id, structuredClone(r));
    },
    async get(id) {
      const r = rows.get(id);
      return r ? structuredClone(r) : null;
    },
    async list(q = {}) {
      return [...rows.values()].filter((r) => matches(r, q)).sort(newestFirst).slice(0, q.limit ?? 100).map((r) => structuredClone(r));
    },
    async update(id, patch) {
      const r = rows.get(id);
      if (r) rows.set(id, { ...r, ...patch });
    },
  };
}

/** The table the SQL store uses. Run these once (they are idempotent). */
export const OTA_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ota_updates (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    channel TEXT NOT NULL,
    runtime_version TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    rollout_percent INTEGER NOT NULL DEFAULT 100,
    paused INTEGER NOT NULL DEFAULT 0,
    body TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS ota_updates_lookup ON ota_updates (channel, runtime_version, platform, created_at)`,
];

/** Anything with libsql's `execute({ sql, args })`: @libsql/client, Turso, or a thin wrapper over another driver. */
export type SqlClient = {
  execute(stmt: { sql: string; args: (string | number | null)[] }): Promise<{ rows: ArrayLike<Record<string, unknown>> }>;
};

const fromRow = (r: Record<string, unknown>): OtaRecord => ({
  id: String(r.id),
  kind: r.kind === "rollback" ? "rollback" : "update",
  channel: String(r.channel),
  runtimeVersion: String(r.runtime_version),
  platform: String(r.platform) as OtaRecord["platform"],
  createdAt: String(r.created_at),
  message: String(r.message ?? ""),
  rolloutPercent: Number(r.rollout_percent),
  paused: Number(r.paused) === 1,
  body: r.body ? JSON.parse(String(r.body)) : null,
});

/** Stores metadata in SQLite / libsql (Turso). Create the table with OTA_SCHEMA_SQL first. */
export function sqlMetadata(client: SqlClient): MetadataStore {
  return {
    async add(r) {
      await client.execute({
        sql: `INSERT INTO ota_updates (id, kind, channel, runtime_version, platform, created_at, message, rollout_percent, paused, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [r.id, r.kind, r.channel, r.runtimeVersion, r.platform, r.createdAt, r.message, r.rolloutPercent, r.paused ? 1 : 0, r.body ? JSON.stringify(r.body) : null],
      });
    },
    async get(id) {
      const { rows } = await client.execute({ sql: `SELECT * FROM ota_updates WHERE id = ?`, args: [id] });
      return rows.length ? fromRow(rows[0]!) : null;
    },
    async list(q = {}) {
      const where: string[] = [];
      const args: (string | number)[] = [];
      if (q.channel) where.push("channel = ?"), args.push(q.channel);
      if (q.runtimeVersion) where.push("runtime_version IN (?, '*')"), args.push(q.runtimeVersion);
      if (q.platform) where.push("platform IN (?, '*')"), args.push(q.platform);
      args.push(q.limit ?? 100);
      const { rows } = await client.execute({
        sql: `SELECT * FROM ota_updates ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ?`,
        args,
      });
      return Array.from(rows, fromRow);
    },
    async update(id, patch) {
      if (patch.rolloutPercent !== undefined) await client.execute({ sql: `UPDATE ota_updates SET rollout_percent = ? WHERE id = ?`, args: [patch.rolloutPercent, id] });
      if (patch.paused !== undefined) await client.execute({ sql: `UPDATE ota_updates SET paused = ? WHERE id = ?`, args: [patch.paused ? 1 : 0, id] });
    },
  };
}
