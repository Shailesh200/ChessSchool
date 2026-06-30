// Pure chess/board helpers — extracted so they're unit-testable and shared instead
// of duplicated across play/game, play/online, placement and ChessBoard.

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Cell = { type: PieceType; color: "w" | "b" } | null;

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Total material per side from a FEN's piece-placement field. */
export function material(fen: string): { w: number; b: number } {
  let w = 0;
  let b = 0;
  for (const ch of fen.split(" ")[0] ?? "") {
    const v = VALUE[ch.toLowerCase()] ?? 0;
    if (ch >= "A" && ch <= "Z") w += v;
    else if (ch >= "a" && ch <= "z") b += v;
  }
  return { w, b };
}

/** Material advantage for a side ("w"/"b"), never negative. */
export function advantage(fen: string, side: "w" | "b"): number {
  const m = material(fen);
  return side === "w" ? Math.max(0, m.w - m.b) : Math.max(0, m.b - m.w);
}

/** Milliseconds → "m:ss" clock string (clamped at 0). */
export function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** 8×8 board (rank 8 first) parsed from a FEN. */
export function fenToBoard(fen: string): Cell[][] {
  return (fen.split(" ")[0] ?? "")
    .split("/")
    .map((row) => {
      const cells: Cell[] = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push(null);
        else cells.push({ type: ch.toLowerCase() as PieceType, color: ch === ch.toLowerCase() ? "b" : "w" });
      }
      return cells;
    });
}

/** Side to move from a FEN. */
export function turnOf(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/** Placement scoring: % correct → starting ELO, school label, and lower stages to skip. */
export function placement(pct: number): { elo: number; label: string; skip: string[] } {
  if (pct >= 0.85) return { elo: 1400, label: "High School", skip: ["elementary", "middle"] };
  if (pct >= 0.55) return { elo: 1000, label: "Middle School", skip: ["elementary"] };
  if (pct >= 0.3) return { elo: 700, label: "Elementary School", skip: [] };
  return { elo: 500, label: "Elementary School", skip: [] };
}

/** Map an online session result string to win/loss/draw for a given color. */
export function onlineOutcome(result: string | null, myColor: "w" | "b"): "win" | "loss" | "draw" | "pending" {
  if (!result) return "pending";
  if (result.includes("1/2")) return "draw";
  const whiteWon = result === "1-0" || result.includes("resign:b") || result.includes("time:w");
  const blackWon = result === "0-1" || result.includes("resign:w") || result.includes("time:b");
  if (myColor === "w") return whiteWon ? "win" : blackWon ? "loss" : "pending";
  return blackWon ? "win" : whiteWon ? "loss" : "pending";
}
