/**
 * Parse `pnpm audit --json` output and compare critical/high advisories to waivers.
 */

/** @typedef {{ id: number, severity: string, module_name?: string, title?: string }} Advisory */

/**
 * @param {unknown} waiverDoc
 * @param {Date} [now]
 * @returns {string[]}
 */
export function activeWaiverIds(waiverDoc, now = new Date()) {
  const raw = waiverDoc?.waivers ?? [];
  const ids = [];
  for (const entry of raw) {
    if (entry == null) continue;
    if (typeof entry === "number" || typeof entry === "string") {
      ids.push(String(entry));
      continue;
    }
    if (typeof entry !== "object") continue;
    const id = entry.id;
    if (id == null) continue;
    if (entry.expires) {
      const exp = new Date(String(entry.expires));
      if (!Number.isNaN(exp.getTime()) && exp < now) continue;
    }
    ids.push(String(id));
  }
  return ids;
}

/**
 * @param {unknown} auditJson
 * @returns {{ advisories: Advisory[], counts: Record<string, number> }}
 */
export function parseAuditReport(auditJson) {
  if (!auditJson || typeof auditJson !== "object") {
    throw new Error("audit JSON must be an object");
  }
  const root = /** @type {{ advisories?: Record<string, Advisory>, metadata?: { vulnerabilities?: Record<string, number> } }} */ (
    auditJson
  );
  const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
  const vuln = root.metadata?.vulnerabilities;
  if (vuln && typeof vuln === "object") {
    for (const k of Object.keys(counts)) {
      if (typeof vuln[k] === "number") counts[k] = vuln[k];
    }
  }

  const advisories = [];
  const adv = root.advisories ?? {};
  for (const value of Object.values(adv)) {
    if (!value || typeof value !== "object") continue;
    const id = Number(value.id);
    const severity = String(value.severity ?? "").toLowerCase();
    if (!Number.isFinite(id) || !severity) continue;
    advisories.push({
      id,
      severity,
      module_name: value.module_name,
      title: value.title,
    });
  }
  return { advisories, counts };
}

/**
 * @param {Advisory[]} advisories
 * @param {string[]} activeIds
 */
export function findUnwaivedCriticalHigh(advisories, activeIds) {
  const waived = new Set(activeIds.map((w) => String(w).trim()).filter(Boolean));
  const unwaived = [];
  for (const a of advisories) {
    if (a.severity !== "critical" && a.severity !== "high") continue;
    if (waived.has(String(a.id))) continue;
    unwaived.push(a);
  }
  return unwaived;
}

/**
 * @param {unknown} auditJson
 * @param {{ waivers?: unknown[] }} waiverDoc
 * @param {Date} [now]
 */
export function evaluateDepsGate(auditJson, waiverDoc, now = new Date()) {
  const { advisories, counts } = parseAuditReport(auditJson);
  const activeIds = activeWaiverIds(waiverDoc, now);
  const unwaived = findUnwaivedCriticalHigh(advisories, activeIds);
  const pass = unwaived.length === 0;
  return {
    pass,
    counts,
    unwaived: unwaived.map((a) => ({
      id: a.id,
      severity: a.severity,
      module: a.module_name,
      title: a.title,
    })),
  };
}
