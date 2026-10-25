/** SQLite result codes. Extended unique is `SQLITE_CONSTRAINT | (8 << 8)`. */
const SQLITE_BUSY = 5;
const SQLITE_CONSTRAINT = 19;
const SQLITE_CONSTRAINT_UNIQUE = 2067;

type ErrorFields = {
  code?: unknown;
  extendedCode?: unknown;
  rawCode?: unknown;
  message: string;
};

function errorChain(err: unknown): ErrorFields[] {
  const chain: ErrorFields[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    chain.push({
      code: record.code,
      extendedCode: record.extendedCode,
      rawCode: record.rawCode,
      message: typeof record.message === "string" ? record.message : "",
    });
    current = record.cause;
  }
  return chain;
}

function codeName(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function rawCode(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * True when libSQL/SQLite rejected `users.email` as a duplicate.
 * Prefers the extended result code (`rawCode` 2067 / `SQLITE_CONSTRAINT_UNIQUE`).
 * Remote Hrana still omits that code, so a base `SQLITE_CONSTRAINT` plus SQLite's
 * `UNIQUE constraint failed: users.email` text is the fallback — message text alone is not.
 */
export function isUsersEmailUniqueViolation(err: unknown): boolean {
  for (const item of errorChain(err)) {
    const raw = rawCode(item.rawCode);
    const extended = codeName(item.extendedCode);
    const code = codeName(item.code);
    if (raw === SQLITE_CONSTRAINT_UNIQUE) return true;
    if (
      extended === "SQLITE_CONSTRAINT_UNIQUE" ||
      code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      return true;
    }
    const baseConstraint =
      raw === SQLITE_CONSTRAINT ||
      code === "SQLITE_CONSTRAINT" ||
      extended === "SQLITE_CONSTRAINT";
    if (
      baseConstraint &&
      item.message.includes("UNIQUE constraint failed:") &&
      item.message.includes("users.email")
    ) {
      return true;
    }
  }
  return false;
}

/** File-driver lock conflict (`SQLITE_BUSY` and its extended codes). */
export function isSqliteBusy(err: unknown): boolean {
  for (const item of errorChain(err)) {
    const raw = rawCode(item.rawCode);
    const extended = codeName(item.extendedCode);
    const code = codeName(item.code);
    if (raw !== undefined && (raw & 0xff) === SQLITE_BUSY) return true;
    if (code === "SQLITE_BUSY" || extended === "SQLITE_BUSY") return true;
    if (code?.startsWith("SQLITE_BUSY_") || extended?.startsWith("SQLITE_BUSY_"))
      return true;
  }
  return false;
}
