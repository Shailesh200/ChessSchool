/**
 * Approved patch-id list validation (check 1 semantics) + identity grep.
 */

/**
 * @param {string} text
 * @returns {{ slot: string, patchId: string, approver: string }[]}
 */
export function parseApprovedRows(text) {
  const rows = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "").trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) {
      rows.push({ slot: parts[0] ?? "", patchId: parts[1] ?? "", approver: parts[2] ?? "", malformed: true });
      continue;
    }
    const [slot, patchId, approver] = parts;
    rows.push({ slot, patchId, approver, malformed: false });
  }
  return rows;
}

/**
 * @param {string} patchId
 */
export function isValidPatchIdToken(patchId) {
  if (/^empty:[0-9a-f]{40}$/.test(patchId)) return "empty";
  if (/^[0-9a-f]{40}$/.test(patchId)) return "pid";
  return null;
}

/**
 * @param {string} approver
 */
export function isValidApprover(approver) {
  return approver === "imu" || approver === "arc";
}

const IDENTITY_RE = /shailesh-arc|arcana|cursoragent|co-authored/i;

/**
 * @param {string} logBlock author/committer/body combined
 */
export function identityViolationInLog(logBlock) {
  return IDENTITY_RE.test(logBlock);
}

/**
 * @typedef {{ patchId: string, commit: string }[]} PatchIdLine
 * @typedef {{ slot: string, patchId: string, approver: string, malformed?: boolean }} Row
 */

/**
 * Pure check-1 evaluator for tests and approved-check.sh (via node CLI).
 *
 * @param {{
 *   rows: Row[],
 *   patchLines: PatchIdLine,
 *   nonMergeCommits: string[],
 *   mergeCommits: string[],
 *   identityLog?: string,
 * }} input
 */
export function evaluateApprovedCheck(input) {
  const errors = [];
  let listRowProblems = 0;
  let duplicatePatch = 0;
  let unlisted = 0;
  let merges = 0;
  let identity = 0;

  if (input.identityLog && identityViolationInLog(input.identityLog)) {
    identity = 1;
    errors.push("identity grep matched forbidden author/committer/body pattern");
  }

  for (const m of input.mergeCommits) {
    if (!m) continue;
    merges++;
    errors.push(`merge commit ${m}`);
  }

  const ncommit = new Map();
  const shas = new Map();
  for (const { patchId, commit } of input.patchLines) {
    ncommit.set(patchId, (ncommit.get(patchId) ?? 0) + 1);
    shas.set(patchId, `${shas.get(patchId) ?? ""} ${commit.slice(0, 10)}`);
  }

  const rowsfor = new Map();
  const okempty = new Set();
  let totalRows = 0;

  for (const row of input.rows) {
    if (row.malformed) {
      listRowProblems++;
      errors.push(`row ${row.slot || "?"} malformed`);
      continue;
    }
    totalRows++;
    const kind = isValidPatchIdToken(row.patchId);
    if (!kind) {
      listRowProblems++;
      errors.push(`row ${row.slot} missing valid patch-id`);
      continue;
    }
    if (!isValidApprover(row.approver)) {
      listRowProblems++;
      errors.push(`row ${row.slot} invalid approver`);
      continue;
    }
    if (kind === "pid") {
      const n = ncommit.get(row.patchId) ?? 0;
      const r = (rowsfor.get(row.patchId) ?? 0) + 1;
      if (n === 0) {
        listRowProblems++;
        errors.push(`row ${row.slot} patch-id not in range`);
        continue;
      }
      if (r > n) {
        listRowProblems++;
        errors.push(`row ${row.slot} duplicate list row for patch-id`);
        continue;
      }
      rowsfor.set(row.patchId, r);
    } else {
      const sha = row.patchId.slice("empty:".length);
      if (okempty.has(sha)) {
        listRowProblems++;
        errors.push(`row ${row.slot} duplicate empty commit`);
        continue;
      }
      const inRange = input.nonMergeCommits.includes(sha);
      const hasDiff = input.patchLines.some((p) => p.commit === sha);
      if (inRange && !hasDiff) {
        okempty.add(sha);
      } else {
        listRowProblems++;
        errors.push(`row ${row.slot} invalid empty commit`);
      }
    }
  }

  if (totalRows === 0 && input.rows.length === 0) {
    listRowProblems++;
    errors.push("approved list has no data rows");
  }

  for (const [pid, n] of ncommit.entries()) {
    if (n <= 1) continue;
    if ((rowsfor.get(pid) ?? 0) !== n) {
      duplicatePatch++;
      errors.push(`DUPLICATE-PATCH ${pid} needs ${n} rows`);
    }
  }

  for (const c of input.nonMergeCommits) {
    const line = input.patchLines.find((p) => p.commit === c);
    if (line) {
      const n = ncommit.get(line.patchId) ?? 0;
      if (n > 1) continue;
      if ((rowsfor.get(line.patchId) ?? 0) >= 1) continue;
    } else if (okempty.has(c)) {
      continue;
    }
    unlisted++;
    errors.push(`UNLISTED ${c}`);
  }

  const pass =
    listRowProblems === 0 &&
    duplicatePatch === 0 &&
    unlisted === 0 &&
    merges === 0 &&
    identity === 0;

  return {
    pass,
    stats: {
      listRowProblems,
      duplicatePatch,
      unlisted,
      merges,
      identity,
      totalRows,
    },
    errors,
  };
}
