import { describe, expect, it } from "vitest";
import {
  evaluateApprovedCheck,
  identityViolationInLog,
  parseApprovedRows,
} from "./lib/approved.mjs";

const commitA = "a".repeat(40);
const commitB = "b".repeat(40);
const pidA = "c".repeat(40);

describe("approved.mjs", () => {
  it("fails when a commit in range is missing from the list", () => {
    const r = evaluateApprovedCheck({
      rows: [],
      patchLines: [{ patchId: pidA, commit: commitA }],
      nonMergeCommits: [commitA],
      mergeCommits: [],
    });
    expect(r.pass).toBe(false);
    expect(r.stats.unlisted).toBeGreaterThan(0);
  });

  it("fails on merge commits in range", () => {
    const merge = "d".repeat(40);
    const r = evaluateApprovedCheck({
      rows: [{ slot: "x", patchId: pidA, approver: "arc" }],
      patchLines: [{ patchId: pidA, commit: commitA }],
      nonMergeCommits: [commitA],
      mergeCommits: [merge],
    });
    expect(r.pass).toBe(false);
    expect(r.stats.merges).toBe(1);
  });

  it("fails identity grep matches", () => {
    const r = evaluateApprovedCheck({
      rows: [{ slot: "x", patchId: pidA, approver: "arc" }],
      patchLines: [{ patchId: pidA, commit: commitA }],
      nonMergeCommits: [commitA],
      mergeCommits: [],
      identityLog: "Someone <x@y.com> | Someone <x@y.com>\nCo-authored-by: Bot",
    });
    expect(r.pass).toBe(false);
    expect(identityViolationInLog("cursoragent")).toBe(true);
  });

  it("passes when list row covers the only commit", () => {
    const r = evaluateApprovedCheck({
      rows: [{ slot: "GT-004", patchId: pidA, approver: "arc" }],
      patchLines: [{ patchId: pidA, commit: commitA }],
      nonMergeCommits: [commitA],
      mergeCommits: [],
    });
    expect(r.pass).toBe(true);
  });

  it("parses approved rows skipping comments", () => {
    const rows = parseApprovedRows(
      `# label patch-id approver\nGT-004 ${pidA} arc\n`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].approver).toBe("arc");
  });
});
