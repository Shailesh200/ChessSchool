#!/usr/bin/env node
/**
 * Summarize stored Core Web Vitals (Phase 2 RUM) from local.db.
 * Usage: node scripts/crux-report.mjs [--days 7]
 */
import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const days = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7);
const dbPath = resolve(process.cwd(), "local.db");
if (!existsSync(dbPath)) {
  console.error("No local.db — run from apps/web after pnpm db:fresh");
  process.exit(1);
}

const db = createClient({ url: `file:${dbPath}` });
const since = Date.now() - days * 86400_000;

const { rows } = await db.execute({
  sql: `SELECT name, rating, AVG(value) AS avg, COUNT(*) AS n
        FROM web_vitals
        WHERE created_at >= ?
        GROUP BY name, rating
        ORDER BY name, rating`,
  args: [since],
});

console.log(`\nCore Web Vitals (last ${days} days)\n${"─".repeat(48)}`);
if (rows.length === 0) {
  console.log("No samples yet — deploy /api/vitals and browse the site.");
  process.exit(0);
}

const byMetric = new Map();
for (const r of rows) {
  const name = r.name;
  if (!byMetric.has(name)) byMetric.set(name, []);
  byMetric.get(name).push(r);
}

for (const [name, entries] of byMetric) {
  const total = entries.reduce((s, e) => s + Number(e.n), 0);
  const good = entries.find((e) => e.rating === "good");
  const goodPct = good ? ((Number(good.n) / total) * 100).toFixed(0) : "0";
  const avgAll = entries.reduce((s, e) => s + Number(e.avg) * Number(e.n), 0) / total;
  const unit = name === "CLS" ? "" : "ms";
  console.log(`${name.padEnd(5)} n=${String(total).padStart(4)}  good=${goodPct.padStart(3)}%  avg=${avgAll.toFixed(name === "CLS" ? 3 : 0)}${unit}`);
}

console.log("");
