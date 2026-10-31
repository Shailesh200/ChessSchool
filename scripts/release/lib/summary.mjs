/**
 * Aggregate gate results for run-all.sh summary.json
 */

/**
 * @param {Record<string, { status: 'PASS'|'FAIL'|'SKIPPED', [key: string]: unknown }>} checks
 */
export function summarizeGateResults(checks) {
  const summary = { checks: { ...checks } };
  let anyFail = false;
  for (const entry of Object.values(checks)) {
    if (entry.status === "FAIL") anyFail = true;
    if (entry.status === "PASS" && entry.skipped) {
      throw new Error("SKIPPED must not be recorded as PASS");
    }
  }
  summary.exitCode = anyFail ? 1 : 0;
  return summary;
}

/**
 * @param {'PASS'|'FAIL'|'SKIPPED'} status
 */
export function assertValidStatus(status) {
  if (status !== "PASS" && status !== "FAIL" && status !== "SKIPPED") {
    throw new Error(`invalid status ${status}`);
  }
}
