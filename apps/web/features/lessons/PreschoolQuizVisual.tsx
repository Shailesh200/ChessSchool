"use client";

import { motion } from "framer-motion";
import { deriveGridHighlights } from "@chess-school/progression";
import type { PreschoolVisual } from "./types";

const LIGHT = "#f0ede4";
const DARK = "#8b9a6b";
const ACCENT = "#5b5bd6";
const FILE_TINT = "rgba(91,91,214,0.22)";
const RANK_TINT = "rgba(52,211,153,0.22)";
const CROSS_TINT = "rgba(91,91,214,0.38)";
const SUCCESS = "#34d399";

function MiniBoard({
  highlight,
  highlightFiles = [],
  highlightRanks = [],
  path,
  size = 220,
  showCoords = true,
}: {
  highlight?: string[];
  highlightFiles?: string[];
  highlightRanks?: number[];
  path?: [string, string];
  size?: number;
  showCoords?: boolean;
}) {
  const pad = showCoords ? Math.max(16, Math.round(size * 0.07)) : 0;
  const inner = size - pad;
  const cell = inner / 8;
  const files = "abcdefgh";
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const hl = new Set(highlight ?? []);
  const fileSet = new Set(highlightFiles);
  const rankSet = new Set(highlightRanks);
  const pathSet = path ? new Set(path) : null;

  const sqFill = (sq: string, light: boolean) => {
    const file = sq[0]!;
    const rank = Number(sq[1]);
    const onFile = fileSet.has(file);
    const onRank = rankSet.has(rank);
    if (hl.has(sq)) return ACCENT;
    if (pathSet?.has(sq)) return SUCCESS;
    if (onFile && onRank) return CROSS_TINT;
    if (onFile) return FILE_TINT;
    if (onRank) return RANK_TINT;
    return light ? LIGHT : DARK;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {showCoords &&
        ranks.map((rank, ri) => (
          <text
            key={`r-${rank}`}
            x={pad * 0.35}
            y={pad + ri * cell + cell * 0.62}
            fontSize={pad * 0.55}
            fontWeight="800"
            fill="#6b6982"
          >
            {rank}
          </text>
        ))}
      {showCoords &&
        files.split("").map((file, fi) => (
          <text
            key={`f-${file}`}
            x={pad + fi * cell + cell * 0.38}
            y={size - pad * 0.25}
            fontSize={pad * 0.55}
            fontWeight="800"
            fill={fileSet.has(file) ? ACCENT : "#6b6982"}
          >
            {file}
          </text>
        ))}
      {ranks.map((rank, ri) =>
        files.split("").map((file, fi) => {
          const sq = `${file}${rank}`;
          const light = (fi + ri) % 2 === 0;
          const isHl = hl.has(sq);
          return (
            <motion.rect
              key={sq}
              x={pad + fi * cell}
              y={pad + ri * cell}
              width={cell}
              height={cell}
              fill={sqFill(sq, light)}
              stroke={isHl ? "#fff" : "none"}
              strokeWidth={isHl ? 2 : 0}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ delay: (fi + ri) * 0.015 }}
            />
          );
        }),
      )}
      {path && (
        <motion.line
          x1={pad + (path[0].charCodeAt(0) - 97 + 0.5) * cell}
          y1={pad + (8 - Number(path[0][1]) + 0.5) * cell}
          x2={pad + (path[1].charCodeAt(0) - 97 + 0.5) * cell}
          y2={pad + (8 - Number(path[1][1]) + 0.5) * cell}
          stroke={SUCCESS}
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        />
      )}
      {highlight?.map((sq) => (
        <motion.text
          key={`lbl-${sq}`}
          x={pad + (sq.charCodeAt(0) - 97 + 0.5) * cell}
          y={pad + (8 - Number(sq[1]) + 0.68) * cell}
          textAnchor="middle"
          fontSize={cell * 0.36}
          fontWeight="800"
          fill="#fff"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.35 }}
        >
          {sq}
        </motion.text>
      ))}
    </svg>
  );
}

function FileColumns() {
  const files = "abcdefgh".split("");
  return (
    <div className="flex gap-1.5">
      {files.map((f, i) => (
        <motion.div
          key={f}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className={`flex h-28 w-7 flex-col items-center justify-end rounded-lg pb-1 text-xs font-extrabold ${
            f === "e" ? "bg-brand text-white" : "bg-surface-sunken text-ink-600"
          }`}
        >
          <span className="mb-auto pt-2 text-[10px] font-bold uppercase tracking-wide opacity-70">file</span>
          {f}
        </motion.div>
      ))}
    </div>
  );
}

function RankRows() {
  return (
    <div className="flex flex-col gap-1.5">
      {[8, 7, 6, 5, 4, 3, 2, 1].map((r, i) => (
        <motion.div
          key={r}
          initial={{ x: -12, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.04 }}
          className={`flex h-7 w-40 items-center gap-2 rounded-lg px-2 text-xs font-extrabold ${
            r <= 2 ? "bg-brand-50 text-brand" : "bg-surface-sunken text-ink-600"
          }`}
        >
          <span className="w-4 text-[10px] font-bold opacity-60">#{r}</span>
          rank {r}
          {r === 1 && <span className="ml-auto text-[10px]">back row</span>}
          {r === 2 && <span className="ml-auto text-[10px]">pawns</span>}
        </motion.div>
      ))}
    </div>
  );
}

const PIECES = [
  { emoji: "♟️", name: "Pawn" },
  { emoji: "♜", name: "Rook" },
  { emoji: "♞", name: "Knight" },
  { emoji: "♝", name: "Bishop" },
  { emoji: "♛", name: "Queen" },
  { emoji: "♚", name: "King" },
];

export function PreschoolQuizVisual({
  visual = "board-grid",
  visualSquare,
  visualSquares,
}: {
  visual?: PreschoolVisual;
  visualSquare?: string;
  visualSquares?: [string, string];
}) {
  const grid = deriveGridHighlights({ visualSquare, visualSquares: visualSquares ? [...visualSquares] : undefined });

  return (
    <div className="flex min-h-[11rem] items-center justify-center rounded-3xl border border-hairline bg-gradient-to-b from-brand-50/80 to-surface-card p-4 [box-shadow:var(--shadow-card)]">
      {visual === "board-grid" && (
        <MiniBoard size={200} highlight={["h1", "a8"]} highlightFiles={["h"]} highlightRanks={[1, 8]} showCoords />
      )}
      {visual === "square" && visualSquare && (
        <MiniBoard
          size={200}
          highlight={[visualSquare]}
          highlightFiles={grid.highlightFiles}
          highlightRanks={grid.highlightRanks}
          showCoords
        />
      )}
      {visual === "square-path" && visualSquares && (
        <MiniBoard
          size={200}
          highlight={visualSquares}
          highlightFiles={grid.highlightFiles}
          highlightRanks={grid.highlightRanks}
          path={visualSquares}
          showCoords
        />
      )}
      {visual === "files" && <FileColumns />}
      {visual === "e-file" && (
        <div className="flex flex-col items-center gap-2">
          <FileColumns />
          <p className="text-xs font-bold text-brand">Kings start on the e-file</p>
        </div>
      )}
      {visual === "ranks" && <RankRows />}
      {visual === "start-ranks" && <RankRows />}
      {visual === "piece-roster" && (
        <div className="grid grid-cols-3 gap-3">
          {PIECES.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.07, type: "spring" }}
              className="flex flex-col items-center gap-1 rounded-2xl bg-surface-card px-3 py-2"
            >
              <span className="text-3xl">{p.emoji}</span>
              <span className="text-[10px] font-extrabold text-ink-600">{p.name}</span>
            </motion.div>
          ))}
        </div>
      )}
      {visual === "royalty" && (
        <div className="flex items-end gap-6">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.2 }} className="text-center">
            <span className="text-5xl">♛</span>
            <p className="mt-1 text-xs font-extrabold text-ink-600">Most powerful</p>
          </motion.div>
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2.2 }} className="text-center">
            <span className="text-5xl">♚</span>
            <p className="mt-1 text-xs font-extrabold text-brand">Most important</p>
          </motion.div>
        </div>
      )}
      {visual === "notation-letters" && (
        <div className="flex flex-wrap justify-center gap-2">
          {[
            ["K", "King"],
            ["Q", "Queen"],
            ["R", "Rook"],
            ["B", "Bishop"],
            ["N", "Knight"],
          ].map(([letter, name], i) => (
            <motion.div
              key={letter}
              initial={{ rotate: -8, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-brand text-white"
            >
              <span className="text-xl font-extrabold">{letter}</span>
              <span className="text-[8px] font-bold opacity-80">{name}</span>
            </motion.div>
          ))}
        </div>
      )}
      {visual === "notation-capture" && (
        <div className="flex flex-col items-center gap-3">
          <motion.span
            className="rounded-2xl bg-surface-sunken px-4 py-2 text-2xl font-extrabold text-ink"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          >
            e<span className="text-danger">x</span>d5
          </motion.span>
          <MiniBoard
            size={160}
            highlight={["e4", "d5"]}
            highlightFiles={["e", "d"]}
            highlightRanks={[4, 5]}
            path={["e4", "d5"]}
            showCoords
          />
          <p className="text-xs font-bold text-ink-500">e-file pawn captures on d5</p>
        </div>
      )}
    </div>
  );
}
