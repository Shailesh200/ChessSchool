"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Chess } from "chess.js";
import { importPuzzleJsonl } from "@/lib/admin-actions";
import { KitIcon } from "./KitIcon";

type RowStatus = "ready" | "warning" | "fix";

type ImportRow = {
  row: number;
  title: string;
  skill: string;
  level: string;
  fen: string;
  status: RowStatus;
  note?: string;
  line?: string[];
};

const LEVELS = ["Easy", "Medium", "Hard"];

/** Design 17 sample, shown until a file is uploaded. */
const SAMPLE: ImportRow[] = [
  {
    row: 12,
    title: "Fork the king and queen",
    skill: "Forks",
    level: "Easy",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R",
    status: "ready",
    line: ["g1f3"],
  },
  {
    row: 13,
    title: "Pin the knight",
    skill: "Pins",
    level: "Easy",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R",
    status: "ready",
    line: ["f1b5"],
  },
  {
    row: 14,
    title: "Back-rank mate in one",
    skill: "Mates",
    level: "Easy",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1",
    status: "ready",
    line: ["a1a8"],
  },
  {
    row: 22,
    title:
      "Win the queen with a skewer that works on any board where the rook is loose",
    skill: "Skewers",
    level: "Hard",
    fen: "3q2k1/8/8/8/8/8/1B6/4K3",
    status: "warning",
    note: "The title has 74 characters. It will wrap on small phones. Try to keep it under 40.",
    line: ["b2a3"],
  },
  {
    row: 31,
    title: "Knight fork on c7",
    skill: "Forks",
    level: "Medum",
    fen: "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/1N6/PPPP1PPP/RNBQKB1R",
    status: "fix",
    note: "Level must be Easy, Medium or Hard. This row says “Medum”.",
  },
  {
    row: 47,
    title: "Smothered mate",
    skill: "Mates",
    level: "Hard",
    fen: "6rk/6pp/8/6N1/8/8/8/8",
    status: "fix",
    note: "This position has no white king. Every position needs one king for each side.",
  },
];

function classify(
  row: Omit<ImportRow, "status" | "note">,
): Pick<ImportRow, "status" | "note"> {
  let chess: Chess;
  try {
    chess = new Chess(row.fen.includes(" ") ? row.fen : `${row.fen} w - - 0 1`);
  } catch {
    return { status: "fix", note: "That position code is not a legal chess position." };
  }
  if (!LEVELS.includes(row.level)) {
    return {
      status: "fix",
      note: `Level must be Easy, Medium or Hard. This row says “${row.level}”.`,
    };
  }
  if (row.title.length > 40) {
    return {
      status: "warning",
      note: `The title has ${row.title.length} characters. It will wrap on small phones. Try to keep it under 40.`,
    };
  }
  if (chess.isCheckmate() || chess.isGameOver()) {
    return { status: "warning", note: "This position is already finished." };
  }
  return { status: "ready" };
}

function toJsonl(rows: ImportRow[]): string {
  return rows
    .filter((r) => r.status !== "fix" && r.line && r.line.length > 0)
    .map((r, i) =>
      JSON.stringify({
        id: `cs-import-${r.row}-${i}`,
        stage: "middle",
        concepts: [r.skill.toLowerCase()],
        rating: r.level === "Hard" ? 1600 : r.level === "Medium" ? 1200 : 800,
        source: "authored",
        fen: r.fen.includes(" ") ? r.fen : `${r.fen} w - - 0 1`,
        line: r.line,
        coach: { setup: r.title.slice(0, 48) },
      }),
    )
    .join("\n");
}

export function AdminImportScreen({
  classes = [],
}: {
  classes?: { id: string; title: string }[];
}) {
  const [rows, setRows] = useState<ImportRow[]>(SAMPLE);
  const [attention, setAttention] = useState(false);
  const [fenDraft, setFenDraft] = useState("6rk/6pp/8/6N1/8/8/6K1/4K3");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(importPuzzleJsonl, undefined);

  const visible = attention ? rows.filter((r) => r.status !== "ready") : rows;
  const summary = useMemo(() => {
    return {
      total: rows.length,
      ready: rows.filter((r) => r.status === "ready").length,
      warnings: rows.filter((r) => r.status === "warning").length,
      fixes: rows.filter((r) => r.status === "fix").length,
    };
  }, [rows]);

  function patch(row: number, next: Partial<ImportRow>) {
    setRows((list) =>
      list.map((item) => {
        if (item.row !== row) return item;
        const merged = { ...item, ...next };
        const judged = classify(merged);
        return { ...merged, ...judged };
      }),
    );
  }

  async function onFile(file: File) {
    const text = await file.text();
    const parsed: ImportRow[] = [];
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, i) => {
        try {
          const obj = JSON.parse(line) as {
            title?: string;
            skill?: string;
            level?: string;
            fen?: string;
            concepts?: string[];
            rating?: number;
            line?: string[];
            coach?: { setup?: string };
          };
          const title = obj.title || obj.coach?.setup || `Puzzle ${i + 1}`;
          const skill = obj.skill || obj.concepts?.[0] || "Forks";
          const level =
            obj.level ||
            (obj.rating && obj.rating >= 1600
              ? "Hard"
              : obj.rating && obj.rating >= 1200
                ? "Medium"
                : "Easy");
          const fen = obj.fen ?? "";
          const base = {
            row: i + 1,
            title,
            skill,
            level,
            fen,
            line: obj.line,
          };
          parsed.push({ ...base, ...classify(base) });
        } catch {
          parsed.push({
            row: i + 1,
            title: "Unreadable row",
            skill: "—",
            level: "—",
            fen: line.slice(0, 80),
            status: "fix",
            note: "This line is not JSON.",
          });
        }
      });
    if (parsed.length) setRows(parsed);
  }

  const publishable = summary.ready + summary.warnings;
  const jsonl = toJsonl(rows);

  return (
    <div className="chopper adm">
      <header className="admtop">
        <span className="logo-h" role="img" aria-label="ChessSchool" />
        <span className="pill">Admin · Puzzle import</span>
      </header>
      <ol className="steps" aria-label="Import steps">
        <li className="done">
          <span className="n">
            <KitIcon name="check" className="sm" />
          </span>
          Upload
        </li>
        <li className="done">
          <span className="n">
            <KitIcon name="check" className="sm" />
          </span>
          Check
        </li>
        <li className="cur" aria-current="step">
          <span className="n">3</span>Fix
        </li>
        <li>
          <span className="n">4</span>Publish
        </li>
      </ol>
      <div>
        <h1>Fix the rows that need it</h1>
        <p className="muted" style={{ marginTop: "0.3rem" }}>
          Warnings can go live as they are. Rows that need a fix are skipped until you
          fix them.
        </p>
      </div>
      <label className="searchbox">
        <span className="over">Upload JSONL</span>
        <input
          type="file"
          accept=".jsonl,application/jsonl,text/plain,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </label>
      <section className="sumgrid" aria-label="Summary">
        <div>
          <b>{summary.total}</b>
          <span>Rows in file</span>
        </div>
        <div>
          <b>{summary.ready}</b>
          <span>Ready</span>
        </div>
        <div className="w">
          <b>{summary.warnings}</b>
          <span>Warnings</span>
        </div>
        <div className="e">
          <b>{summary.fixes}</b>
          <span>Need a fix</span>
        </div>
      </section>
      <div className="chips" role="group" aria-label="Show rows">
        <button
          type="button"
          className="fchip"
          aria-pressed={!attention}
          onClick={() => setAttention(false)}
        >
          All {summary.total}
        </button>
        <button
          type="button"
          className="fchip"
          aria-pressed={attention}
          onClick={() => setAttention(true)}
        >
          Needs attention ({summary.warnings + summary.fixes})
        </button>
      </div>
      <ol className="tbl" aria-label="Preview rows">
        {visible.map((row) => (
          <li
            key={row.row}
            className={`tr ${row.status === "warning" ? "warn" : row.status === "fix" ? "bad" : ""}`}
            aria-label={`Row ${row.row}`}
          >
            <div className="c">
              <span>Row</span>
              <span>{row.row}</span>
            </div>
            <div className="c">
              <span>Title</span>
              <span>
                <b>{row.title}</b>
              </span>
            </div>
            <div className="c">
              <span>Skill</span>
              <span>{row.skill}</span>
            </div>
            <div className="c">
              <span>Level</span>
              <span>
                {row.status === "fix" && !LEVELS.includes(row.level) ? (
                  <b>{row.level}</b>
                ) : (
                  row.level
                )}
              </span>
            </div>
            <div className="c">
              <span>Position</span>
              <span>
                <code>{row.fen}</code>
              </span>
            </div>
            <div className="c">
              <span>Status</span>
              <span>
                <span
                  className={`pill ${row.status === "ready" ? "ok" : row.status === "warning" ? "warn" : "bad"}`}
                >
                  {row.status === "ready"
                    ? "Ready"
                    : row.status === "warning"
                      ? "Warning"
                      : "Fix needed"}
                </span>
              </span>
            </div>
            {row.note && row.status === "warning" && (
              <div className="fix">{row.note}</div>
            )}
            {row.status === "fix" && !LEVELS.includes(row.level) && (
              <div className="fix" role="group" aria-label={`Fix row ${row.row}`}>
                <div>{row.note}</div>
                <div className="act">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => patch(row.row, { level: "Medium" })}
                  >
                    Use “Medium”
                  </button>
                </div>
              </div>
            )}
            {row.status === "fix" && LEVELS.includes(row.level) && (
              <div className="fix" role="group" aria-label={`Fix row ${row.row}`}>
                <div>{row.note}</div>
                <label htmlFor={`fx${row.row}`}>Position code (FEN)</label>
                <div className="inp">
                  <input
                    id={`fx${row.row}`}
                    value={row.row === 47 ? fenDraft : row.fen}
                    spellCheck={false}
                    onChange={(e) => setFenDraft(e.target.value)}
                  />
                </div>
                <div className="act">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => patch(row.row, { fen: fenDraft, line: ["g5f7"] })}
                  >
                    Apply fix
                  </button>
                  <button
                    type="button"
                    className="btn sm line"
                    onClick={() =>
                      setRows((list) => list.filter((item) => item.row !== row.row))
                    }
                  >
                    Skip this row
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <form action={formAction} className="act">
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="jsonl" value={jsonl} />
        {classes.length > 0 && (
          <label className="searchbox" style={{ marginRight: "auto" }}>
            <span className="over">Class</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              aria-label="Target class"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <Link className="btn line" href="/admin">
          Back
        </Link>
        <button
          className="btn coral"
          type="submit"
          disabled={pending || !jsonl || !classId}
        >
          {pending ? "Publishing…" : `Publish ${publishable} puzzles`}
        </button>
      </form>
      <p className="help">
        {summary.fixes} row{summary.fixes === 1 ? "" : "s"} with errors will be skipped.
      </p>
      {state?.error && <p className="pill bad">{state.error}</p>}
      {state?.ok && <p className="pill ok">{state.message}</p>}
    </div>
  );
}
