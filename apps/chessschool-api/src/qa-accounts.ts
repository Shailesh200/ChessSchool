import { users } from "./schema";
import { deleteUserData } from "./account-delete";
import type { Db } from "./db";

/** Local part of a QA mailbox: qa+<tester>-<sha7>-<n> */
export const QA_LOCAL_PART = /^qa\+[a-z0-9]+-[0-9a-f]{7}-[0-9]+$/i;

export function isQaEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@") || at === trimmed.length - 1) return false;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!QA_LOCAL_PART.test(local)) return false;
  if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return true;
}

export type AllowList = { emails: string[]; rejected: string[]; error?: string };

/** Reads the email column of a markdown table. Comparison is trimmed and case-insensitive. */
export function parseAllowList(markdown: string): AllowList {
  const rows: string[][] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length === 0 || cells.every((cell) => cell.length === 0)) continue;
    rows.push(cells);
  }
  const header = rows.findIndex((row) => (row[0] ?? "").toLowerCase() === "email");
  if (header < 0) return { emails: [], rejected: [], error: "allow-list has no email column" };
  const emails: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(header + 1)) {
    const cell = (row[0] ?? "").trim();
    if (!cell || /^:?-+:?$/.test(cell)) continue;
    if (!isQaEmail(cell)) {
      rejected.push(cell);
      continue;
    }
    const email = cell.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return { emails, rejected };
}

export type QaReport = {
  found: { id: string; email: string }[];
  missing: string[];
  unlisted: string[];
  deleted: string[];
  refused?: string;
};

/**
 * Deletes users who are on the allow-list and match the QA email shape.
 * Pattern matches that are not listed are reported and left in place.
 */
export async function runQaCleanup(db: Db, opts: { emails: string[]; apply: boolean; max: number }): Promise<QaReport> {
  const allow = new Set(opts.emails.map((email) => email.trim().toLowerCase()).filter((email) => isQaEmail(email)));
  const all = await db.select({ id: users.id, email: users.email }).from(users);
  const byEmail = new Map(all.map((row) => [row.email.toLowerCase(), row]));
  const found: { id: string; email: string }[] = [];
  const missing: string[] = [];
  for (const email of allow) {
    const row = byEmail.get(email);
    if (row) found.push({ id: row.id, email: row.email });
    else missing.push(email);
  }
  const unlisted = all.filter((row) => isQaEmail(row.email) && !allow.has(row.email.toLowerCase())).map((row) => row.email);
  if (found.length > opts.max) {
    return { found, missing, unlisted, deleted: [], refused: `${found.length} matches exceed max ${opts.max}` };
  }
  const deleted: string[] = [];
  if (opts.apply) {
    for (const row of found) {
      await deleteUserData(db, row.id);
      deleted.push(row.email.toLowerCase());
    }
  }
  return { found, missing, unlisted, deleted };
}

export type CleanupArgs = {
  list?: string;
  apply: boolean;
  max: number;
  remoteProd: boolean;
  confirmCount?: string;
  error?: string;
};

export function parseCleanupArgs(argv: string[]): CleanupArgs {
  let list: string | undefined;
  let apply = false;
  let max = 200;
  let remoteProd = false;
  let confirmCount: string | undefined;
  const base = { apply, max, remoteProd };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--apply") apply = true;
    else if (arg === "--remote-prod") remoteProd = true;
    else if (arg === "--list") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { ...base, apply, remoteProd, error: "--list is required" };
      list = value;
      i += 1;
    } else if (arg.startsWith("--list=")) {
      list = arg.slice("--list=".length);
      if (!list) return { ...base, apply, remoteProd, error: "--list is required" };
    } else if (arg === "--max") {
      max = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--max=")) max = Number(arg.slice("--max=".length));
    else if (arg === "--confirm-count") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return { ...base, apply, remoteProd, error: "--confirm-count needs a number" };
      confirmCount = value;
      i += 1;
    } else if (arg.startsWith("--confirm-count=")) confirmCount = arg.slice("--confirm-count=".length);
    else return { ...base, apply, remoteProd, error: "unknown argument" };
  }
  if (!list) return { apply, max, remoteProd, confirmCount, error: "--list is required" };
  if (!Number.isInteger(max) || max < 0) return { list, apply, max, remoteProd, confirmCount, error: "--max must be a non-negative integer" };
  return { list, apply, max, remoteProd, confirmCount };
}

export type DbTarget = { ok: true; location: "local" | "remote"; url: string } | { ok: false; message: string };

/** A file URL is local. Anything else stays closed unless --remote-prod is set. The message never includes the URL. */
export function resolveDbTarget(url: string | undefined, remoteProd: boolean): DbTarget {
  if (url?.startsWith("file:")) return { ok: true, location: "local", url };
  if (!remoteProd) return { ok: false, message: "Refusing to run: DATABASE_URL must be a local sqlite file." };
  if (!url) return { ok: false, message: "Refusing to run: DATABASE_URL must be a local sqlite file." };
  return { ok: true, location: "remote", url };
}

export function confirmMatches(typed: string | undefined, found: number): boolean {
  return typed?.trim() === String(found);
}

function sqlText(stmt: unknown): string {
  if (typeof stmt === "string") return stmt;
  if (stmt && typeof stmt === "object" && "sql" in stmt && typeof (stmt as { sql: unknown }).sql === "string") return (stmt as { sql: string }).sql;
  return "";
}

function isReadStatement(sql: string): boolean {
  const text = sql.trim().replace(/^\/\*[\s\S]*?\*\//, "").trim().toLowerCase();
  if (text.startsWith("select") || text.startsWith("with")) return true;
  return text.startsWith("pragma") && !text.includes("=");
}

/** Rejects every statement that is not a read. Used for a remote dry-run. */
export function lockReadsOnly(db: Db): { writes: number; restore: () => void } {
  const client = db.$client as {
    execute: (stmt: unknown) => Promise<unknown>;
    batch?: (stmts: unknown) => Promise<unknown>;
    transaction?: () => Promise<unknown>;
  };
  const previous = client.execute.bind(client);
  const previousBatch = client.batch?.bind(client);
  const previousTransaction = client.transaction?.bind(client);
  const state = { writes: 0 };
  const refuse = () => {
    state.writes += 1;
    throw new Error("remote dry-run refuses writes");
  };
  client.execute = async (stmt: unknown) => {
    if (!isReadStatement(sqlText(stmt))) refuse();
    return previous(stmt);
  };
  if (previousBatch) {
    client.batch = async (stmts: unknown) => {
      const list = Array.isArray(stmts) ? stmts : [stmts];
      for (const stmt of list) if (!isReadStatement(sqlText(stmt))) refuse();
      return previousBatch(stmts);
    };
  }
  if (previousTransaction) client.transaction = async () => refuse();
  return Object.assign(state, {
    restore: () => {
      client.execute = previous;
      if (previousBatch) client.batch = previousBatch;
      if (previousTransaction) client.transaction = previousTransaction;
    },
  });
}
