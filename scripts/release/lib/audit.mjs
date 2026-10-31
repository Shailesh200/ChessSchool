/**
 * Parse `pnpm audit --json` output and compare critical/high advisories to waivers.
 */

/** @typedef {{ id: number, severity: string, module_name?: string, title?: string }} Advisory */

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
 * @param {string[] | number[]} waivers
 */
export function findUnwaivedCriticalHigh(advisories, waivers) {
  const waived = new Set(
    (waivers ?? []).map((w) => String(w).trim()).filter(Boolean),
  );
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
 * @param {{ waivers?: (string|number)[] }} waiverDoc
 */
export function evaluateDepsGate(auditJson, waiverDoc) {
  const { advisories, counts } = parseAuditReport(auditJson);
  const waivers = waiverDoc?.waivers ?? [];
  const unwaived = findUnwaivedCriticalHigh(advisories, waivers);
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
