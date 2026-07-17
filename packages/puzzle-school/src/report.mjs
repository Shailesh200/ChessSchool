/** @typedef {'success'|'rejected'|'skipped'|'warning'} OutcomeKind */

/**
 * @typedef {Object} ReportItem
 * @property {string} id
 * @property {string} reason
 * @property {string} [detail]
 * @property {string} [code]
 */

/**
 * @typedef {Object} ImportReport
 * @property {string} runAt
 * @property {string} command
 * @property {string} [source]
 * @property {number} durationMs
 * @property {{ scanned: number, inserted: number, updated: number, skipped: number, rejected: number, warnings: number }} summary
 * @property {{ success: string[], rejected: ReportItem[], skipped: ReportItem[], warnings: ReportItem[] }} byOutcome
 * @property {Record<string, { inserted?: number, rejected?: number, skipped?: number }>} byBucket
 * @property {number} exitCode
 */

export function emptyReport(command, source = "") {
  return {
    runAt: new Date().toISOString(),
    command,
    source,
    durationMs: 0,
    summary: {
      scanned: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      rejected: 0,
      warnings: 0,
    },
    byOutcome: { success: [], rejected: [], skipped: [], warnings: [] },
    byBucket: {},
    exitCode: 0,
  };
}

export function bumpBucket(report, bucket, field) {
  if (!report.byBucket[bucket]) report.byBucket[bucket] = {};
  report.byBucket[bucket][field] = (report.byBucket[bucket][field] ?? 0) + 1;
}

export function printReportSummary(report) {
  const s = report.summary;
  const line = "═".repeat(50);
  console.log(`\n${line}`);
  console.log(" Curriculum report");
  console.log(line);
  console.log(`  Command:    ${report.command}`);
  if (report.source) console.log(`  Source:     ${report.source}`);
  console.log(`  Scanned:    ${s.scanned.toLocaleString()}`);
  const passLabel = report.command === "validate" ? "Valid" : "Inserted";
  console.log(`  ${passLabel.padEnd(10)} ${s.inserted.toLocaleString()}  ✓`);
  console.log(`  Rejected:   ${s.rejected.toLocaleString()}  ✗`);
  console.log(`  Skipped:    ${s.skipped.toLocaleString()}  ○`);
  console.log(`  Warnings:   ${s.warnings.toLocaleString()}  ⚠`);
  console.log(`  Duration:   ${(report.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Exit code:  ${report.exitCode}`);
  console.log(line);
}

export function finalizeReport(report, { failOnReject = true, failOnWarn = false } = {}) {
  if (report.summary.rejected > 0 && failOnReject) report.exitCode = 1;
  else if (report.summary.warnings > 0 && failOnWarn) report.exitCode = 1;
  else if (report.exitCode === 0) report.exitCode = 0;
  return report;
}
