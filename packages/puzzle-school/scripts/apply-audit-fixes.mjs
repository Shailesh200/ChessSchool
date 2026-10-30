#!/usr/bin/env node
/**
 * Apply puzzle bank fixes: replace failing puzzles using verified donors from the same bucket.
 * Donor rows are removed so FEN/lines are not duplicated.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank } from "../src/bank.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const repoRoot = join(pkgRoot, "../..");

function parseCsvRow(line) {
  const parts = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}

function loadAuditCsv(path) {
  if (!existsSync(path)) return new Map();
  const text = readFileSync(path, "utf8").trim();
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of text.split("\n").slice(1)) {
    const cols = parseCsvRow(line);
    if (cols[0]) map.set(cols[0], cols[5] ?? "");
  }
  return map;
}

function isHardFailure(failures) {
  if (!failures) return false;
  if (failures.includes("mate_not_mate")) return true;
  if (failures.startsWith("legal:") || failures.includes("side:")) return true;
  if (failures.includes("engine:")) return true;
  if (failures.includes("rating_implausible")) return true;
  if (failures.includes("rating_out_of_band")) return true;
  if (failures.includes("correct:not_best")) return true;
  if (failures.includes("unique:")) return true;
  if (failures.includes("depth_unlikely")) return true;
  return false;
}

function walkJsonlFiles(bankDir) {
  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".jsonl")) files.push(p);
    }
  };
  walk(bankDir);
  return files;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return [a.slice(2, i), a.slice(i + 1)];
    }),
);

const bankDir = args.bank ?? join(pkgRoot, "data/puzzles");
const fastCsv = args.fast ?? join(repoRoot, "plans/content-audit/puzzles-audit-fast.csv");
const deepCsv = args.deep ?? join(repoRoot, "plans/content-audit/puzzles-audit-deep.csv");
const outLog = args.out ?? join(repoRoot, "plans/content-audit/changelog.json");

const fast = loadAuditCsv(fastCsv);
const deep = loadAuditCsv(deepCsv);

function shouldFix(id) {
  const d = deep.get(id);
  if (d !== undefined) return isHardFailure(d);
  const f = fast.get(id) ?? "";
  if (!f) return false;
  if (f.includes("fork_weak") && !f.match(/correct|unique|mate_not_mate|engine|depth_unlikely|rating_/)) {
    return false;
  }
  return isHardFailure(f);
}

const all = loadBank(bankDir);
const fixIds = new Set(all.filter((p) => shouldFix(p.id)).map((p) => p.id));

/** @type {Map<string, object[]>} */
const spare = new Map();
for (const p of all) {
  if (fixIds.has(p.id)) continue;
  const key = `${p.stage}:${p.concepts[0]}`;
  const arr = spare.get(key) ?? [];
  arr.push({ ...p });
  spare.set(key, arr);
}

/** @type {Map<string, { donor: object, reason: string }>} */
const assignments = new Map();
/** @type {Set<string>} */
const consumedDonors = new Set();

for (const p of all) {
  if (!fixIds.has(p.id)) continue;
  const reason = deep.get(p.id) || fast.get(p.id) || "hard_fail";
  const key = `${p.stage}:${p.concepts[0]}`;
  const pool = spare.get(key) ?? [];
  let donor = null;
  while (pool.length) {
    const cand = pool.pop();
    if (fixIds.has(cand.id) || consumedDonors.has(cand.id)) continue;
    donor = cand;
    break;
  }
  if (donor) {
    consumedDonors.add(donor.id);
    assignments.set(p.id, { donor, reason });
  }
}

/** @type {Array<{id:string, action:string, reason:string, donor?:string}>} */
const changelog = [];
let replaced = 0;
let removed = 0;
let keptDoubtful = 0;

/** @type {Record<string, object[]>} */
const byFile = {};
for (const f of walkJsonlFiles(bankDir)) {
  byFile[f] = [];
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    byFile[f].push(JSON.parse(t));
  }
}

for (const [path, rows] of Object.entries(byFile)) {
  const next = [];
  for (const p of rows) {
    if (consumedDonors.has(p.id)) continue;

    const failFast = fast.get(p.id) ?? "";
    const assign = assignments.get(p.id);
    if (assign) {
      next.push({ ...assign.donor, id: p.id });
      replaced++;
      changelog.push({
        id: p.id,
        action: "replaced",
        reason: assign.reason,
        donor: assign.donor.id,
      });
      continue;
    }

    if (fixIds.has(p.id)) {
      removed++;
      changelog.push({ id: p.id, action: "removed", reason: deep.get(p.id) || failFast || "hard_fail" });
      continue;
    }

    if (failFast.includes("fork_weak")) {
      keptDoubtful++;
      changelog.push({ id: p.id, action: "keep", reason: "doubtful_fork_heuristic" });
    }
    next.push(p);
  }
  writeFileSync(path, `${next.map((r) => JSON.stringify(r)).join("\n")}\n`);
}

writeFileSync(
  outLog,
  JSON.stringify({ changelog, replaced, removed, keptDoubtful, fixIds: fixIds.size }, null, 2),
);
console.log(JSON.stringify({ fixIds: fixIds.size, replaced, removed, keptDoubtful }, null, 2));
