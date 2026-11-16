/**
 * Checks every line of copy.ts against copy.hi.ts and writes a Markdown report.
 *   pnpm --filter @chessschool/design hindi:review [report.md]
 * Hard errors (exit 1): a missing translation, or a function line whose Hindi drops or adds an
 * interpolated value. Everything else is a soft finding for a human (or the hindi-reviewer agent).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copy } from "../src/copy";
import { hi } from "../src/copy.hi";

export type Severity = "hard" | "soft";
export type Finding = { key: string; severity: Severity; reason: string; en: string; hi: string };

/** Names and terms that stay in Latin letters in Hindi. */
const KEEP_LATIN = new Set(
  "ChessSchool Cody Google Apple Lichess Chess.com Chess com PGN FEN XP AI Anthropic Groq Cloudflare Workers PIN QR OK ID URL Elo Glicko SAN email support chess-school in iOS Android TestFlight Play Store App NaN undefined".toLowerCase().split(" "),
);

/** Glossary pairs from the comment at the top of copy.hi.ts ("राजा king · रानी queen …"). */
export function parseGlossary(source: string): { hi: string; en: string }[] {
  const block = /Glossary:([\s\S]*?)The learner/.exec(source)?.[1] ?? "";
  return block
    .replace(/\n\s*\*/g, " ")
    .split("·")
    .map((part) => /([^\s]+)\s+([a-z]+)/i.exec(part.trim()))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ hi: m[1], en: m[2].toLowerCase() }));
}

const STR_ARGS = ["zqa", "zqb", "zqc", "zqd"];
const NUM_ARGS = [7001, 7002, 7003, 7004];
const ARR_ARGS = [["zqa", "zqb"]];
const markers = (out: string, args: readonly unknown[]) => args.map(String).filter((a) => out.includes(a)).sort().join(",");

type Fn = (...a: unknown[]) => unknown;
const call = (fn: Fn, args: unknown[]): string | null => {
  try {
    const out = fn(...args);
    return typeof out === "string" ? out : null;
  } catch {
    return null;
  }
};

/** Placeholder parity: the same sample arguments must show up in the English and Hindi results. */
function checkFunction(key: string, en: Fn, h: Fn): { finding: Finding | null; enOut: string; hiOut: string } {
  let sample = { en: "", hi: "" };
  for (const pool of [STR_ARGS, NUM_ARGS, ARR_ARGS] as unknown[][]) {
    const args = pool.slice(0, Math.max(en.length, 1));
    if (pool === ARR_ARGS && args.length !== 1) continue;
    const e = call(en, args);
    if (e === null) continue;
    const t = call(h, args);
    if (t === null) return { finding: { key, severity: "hard", reason: "Hindi function throws or returns no text for sample arguments", en: e, hi: "" }, enOut: e, hiOut: "" };
    if (!sample.en) sample = { en: e, hi: t };
    if (markers(e, args) !== markers(t, args)) {
      return { finding: { key, severity: "hard", reason: `Placeholder mismatch: English shows [${markers(e, args)}], Hindi shows [${markers(t, args)}]`, en: e, hi: t }, enOut: e, hiOut: t };
    }
  }
  return { finding: null, enOut: sample.en, hiOut: sample.hi };
}

/** Hindi nouns inflect (प्यादा → प्यादे): match the stem without its final vowel sign; शह-मात also matches मात. */
const stems = (term: string) => [term.replace(/[\u093e-\u094c]$/u, ""), ...term.split("-").slice(1)];
/** Text with nothing to translate: only kept names, numbers, symbols or an email address. */
const neutral = (s: string) => (strip(s).replace(/\S+@\S+/g, "").match(/[A-Za-z][A-Za-z.'-]*/g) ?? []).every((w) => KEEP_LATIN.has(w.toLowerCase().replace(/[.']+$/, "")));
const sampleOf = (fn: Fn) => call(fn, STR_ARGS) ?? call(fn, NUM_ARGS) ?? call(fn, ARR_ARGS);
/** Sample arguments and web links are not text to translate. */
const strip = (s: string) => s.replace(/zq[a-d]|700[1-4]|350[0-2]|https?:\/\/\S+/g, "");

function softChecks(key: string, en: string, h: string, glossary: { hi: string; en: string }[]): Finding[] {
  const out: Finding[] = [];
  const add = (reason: string) => out.push({ key, severity: "soft", reason, en, hi: h });
  const e = strip(en);
  const t = strip(h);
  if (/(^|[^\p{L}])(तुम|तुम्हें|तुम्हारा|तुम्हारी|तुम्हारे|तू|तेरा|तेरी|तेरे)(?![\p{L}\p{M}])/u.test(t)) add('Uses तुम/तू; address the learner as "आप"');
  for (const g of glossary) {
    // "check" is also an everyday verb ("Check your connection"); only the chess noun needs शह.
    const used = g.en === "check" ? /\bcheck\b(?!\s+(your|for|the|that|and|out|it|again))/i.test(e) && !/you check/i.test(e) : new RegExp(`\\b${g.en}(s|es)?\\b`, "i").test(e);
    if (used && !stems(g.hi).some((st) => t.includes(st))) add(`Glossary: "${g.en}" should be "${g.hi}"`);
  }
  const latin = (t.match(/[A-Za-z][A-Za-z.'-]*/g) ?? []).filter((w) => !KEEP_LATIN.has(w.toLowerCase().replace(/[.']+$/, "")) && !/^[a-h][1-8]$/.test(w) && w.length > 1 && w !== "NaN" && w !== "undefined");
  if (latin.length) add(`Latin words left untranslated: ${[...new Set(latin)].join(", ")}`);
  if (e.length >= 16) {
    const ratio = t.length / e.length;
    if (ratio < 0.45 || ratio > 2.2) add(`Length ratio ${ratio.toFixed(2)} (Hindi vs English) looks off`);
  }
  return out;
}

/** Walks the English copy; `hiTree` has the same shape with any subset filled in. */
export function reviewHindi(enTree: unknown, hiTree: unknown, glossary: { hi: string; en: string }[]): Finding[] {
  const findings: Finding[] = [];
  const walk = (en: unknown, h: unknown, key: string) => {
    if (typeof en === "string") {
      if (en === h && /^[A-Za-z]+$/.test(en)) return; // ids and icon names, not text
      if (typeof h !== "string" || !h.trim()) return void (!neutral(en) && findings.push({ key, severity: "hard", reason: "Missing translation", en, hi: "" }));
      return void findings.push(...softChecks(key, en, h, glossary));
    }
    if (typeof en === "function") {
      if (typeof h !== "function") {
        const sample = sampleOf(en as Fn);
        if (sample !== null && neutral(sample)) return;
        return void findings.push({ key, severity: "hard", reason: "Missing translation", en: sample ?? "(function)", hi: "" });
      }
      const r = checkFunction(key, en as Fn, h as Fn);
      if (r.finding) return void findings.push(r.finding);
      if (r.enOut && r.hiOut) findings.push(...softChecks(key, r.enOut, r.hiOut, glossary));
      return;
    }
    if (Array.isArray(en)) {
      if (!Array.isArray(h)) return void findings.push({ key, severity: "hard", reason: "Missing translation", en: JSON.stringify(en).slice(0, 120), hi: "" });
      if (h.length !== en.length) findings.push({ key, severity: "hard", reason: `List has ${h.length} items in Hindi, ${en.length} in English`, en: "", hi: "" });
      en.forEach((v, i) => walk(v, h[i], `${key}[${i}]`));
      return;
    }
    if (en && typeof en === "object") {
      const ho = h && typeof h === "object" ? (h as Record<string, unknown>) : {};
      for (const [k, v] of Object.entries(en)) walk(v, ho[k], key ? `${key}.${k}` : k);
    }
  };
  walk(enTree, hiTree, "");
  return findings;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function reportMarkdown(findings: Finding[]): string {
  const hard = findings.filter((f) => f.severity === "hard");
  const soft = findings.filter((f) => f.severity === "soft");
  const table = (rows: Finding[]) => ["| Key | English | Hindi | Reason |", "| --- | --- | --- | --- |", ...rows.map((f) => `| \`${f.key}\` | ${cell(f.en)} | ${cell(f.hi)} | ${cell(f.reason)} |`)].join("\n");
  return [
    "# Hindi review",
    "",
    `Generated by \`pnpm --filter @chessschool/design hindi:review\`. Hard errors: ${hard.length}. Soft findings: ${soft.length}.`,
    "",
    "## Hard errors",
    "",
    hard.length ? table(hard) : "None.",
    "",
    "## Soft findings",
    "",
    soft.length ? table(soft) : "None.",
    "",
  ].join("\n");
}

const here = dirname(fileURLToPath(import.meta.url));
export const glossaryFromSource = () => parseGlossary(readFileSync(join(here, "../src/copy.hi.ts"), "utf8"));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = reviewHindi(copy, hi, glossaryFromSource());
  const out = process.argv[2] ?? join(here, "../hindi-review.md");
  writeFileSync(out, reportMarkdown(findings));
  const hard = findings.filter((f) => f.severity === "hard");
  console.log(`hindi-review: ${hard.length} hard, ${findings.length - hard.length} soft → ${out}`);
  for (const f of hard) console.log(`  ${f.key}: ${f.reason}`);
  process.exit(hard.length ? 1 : 0);
}
