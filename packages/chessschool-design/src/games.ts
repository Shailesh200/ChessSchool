import { GAME_LOG_MAX, START_FEN, type GameRecord, type StoredSetup } from "./progress";

/**
 * "My games": what kind of game a log entry is, how it ended for the learner, filters for the list,
 * PGN export, and merging the device's log with the copy saved on the account.
 */
export type GameKind = "bot" | "friend" | "challenge" | "imported" | "scanned";
export type GameOutcomeForYou = "win" | "loss" | "draw";
export const GAME_KINDS: readonly GameKind[] = ["bot", "challenge", "friend", "imported"];
export const GAME_RESULTS: readonly GameOutcomeForYou[] = ["win", "loss", "draw"];

export function gameKind(g: GameRecord): GameKind {
  if (g.reason === "scanned") return "scanned";
  if (g.reason === "challenge") return "challenge";
  if (g.reason === "imported" || g.setup.opponent.kind === "online") return "imported";
  return g.setup.opponent.kind === "bot" ? "bot" : "friend";
}

/** The result from the learner's side; null when both sides were the learner's (pass and play) or nothing was played. */
export function resultForYou(g: GameRecord): GameOutcomeForYou | null {
  const kind = gameKind(g);
  if (kind === "scanned" || kind === "friend") return null;
  if (g.winner === null) return g.reason === "imported" && !g.history.length ? null : "draw";
  return g.winner === g.setup.you ? "win" : "loss";
}

export type GameFilter = { kind: GameKind | "all"; result: GameOutcomeForYou | "all"; bot?: string | null };
export const ALL_GAMES: GameFilter = { kind: "all", result: "all", bot: null };

export function filterGames(log: readonly GameRecord[], f: GameFilter): GameRecord[] {
  return log.filter((g) => {
    if (f.kind !== "all" && gameKind(g) !== f.kind) return false;
    if (f.result !== "all" && resultForYou(g) !== f.result) return false;
    if (f.bot && !(g.setup.opponent.kind === "bot" && g.setup.opponent.bot === f.bot)) return false;
    return true;
  });
}

/** Bots that appear in the log, most played first (for the opponent filter). */
export function botsInLog(log: readonly GameRecord[]): string[] {
  const n = new Map<string, number>();
  for (const g of log) if (g.setup.opponent.kind === "bot") n.set(g.setup.opponent.bot, (n.get(g.setup.opponent.bot) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/* ---------------- PGN ---------------- */

const tag = (v: string) => v.replace(/[\\"]/g, "").replace(/[\r\n]+/g, " ").slice(0, 80);
const pgnDate = (ms: number) => {
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}` : "????.??.??";
};
export const pgnResult = (g: Pick<GameRecord, "winner" | "reason" | "history">, over = true) => (!over ? "*" : g.winner === "w" ? "1-0" : g.winner === "b" ? "0-1" : g.reason === "scanned" ? "*" : "1/2-1/2");

/** Numbered SAN movetext from `startFen` ("1. e4 e5 2. Nf3", or "5... Kd7 6. Kd2" when Black starts). */
export function movetext(startFen: string, sans: readonly string[]): string {
  const parts = startFen.trim().split(/\s+/);
  let black = parts[1] === "b";
  let n = Number(parts[5]) || 1;
  const out: string[] = [];
  sans.forEach((san, i) => {
    if (!black) out.push(`${n}.`);
    else if (i === 0) out.push(`${n}...`);
    out.push(san);
    if (black) n++;
    black = !black;
  });
  return out.join(" ");
}

/** Wraps movetext at 80 columns, as PGN readers expect. */
function wrap(text: string, width = 80): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/** A finished game as PGN. `names` are the player labels (the learner and their opponent, already in the app language). */
export function gamePgn(g: GameRecord, names: { white: string; black: string }, event = "ChessSchool"): string {
  const result = pgnResult(g);
  const headers: [string, string][] = [
    ["Event", event],
    ["Site", "https://chess-school.in"],
    ["Date", pgnDate(g.endedAt)],
    ["White", names.white],
    ["Black", names.black],
    ["Result", result],
  ];
  if (g.setup.startFen.trim() !== START_FEN) headers.push(["SetUp", "1"], ["FEN", g.setup.startFen.trim()]);
  const body = wrap(`${movetext(g.setup.startFen, g.history)} ${result}`.trim());
  return `${headers.map(([k, v]) => `[${k} "${tag(v)}"]`).join("\n")}\n\n${body}\n`;
}

/** A file name for the PGN download: chessschool-2026-11-20-pip.pgn */
export const pgnFileName = (g: GameRecord, opponent: string) => `chessschool-${pgnDate(g.endedAt).replace(/\./g, "-")}-${opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game"}.pgn`;

/* ---------------- account copy ---------------- */

const ID = /^[A-Za-z0-9:_.-]{1,80}$/;
const SAN = /^[A-Za-z0-9+#=-]{2,10}$/;
const BOT = /^[a-z]{2,12}$/;
export const SAVED_GAME_MOVES_MAX = 600;

/** A game from the server or a request body, checked field by field. Null when anything is off. */
export function sanitizeGameRecord(raw: unknown): GameRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const s = g.setup as Record<string, unknown> | undefined;
  if (typeof g.id !== "string" || !ID.test(g.id)) return null;
  if (typeof g.endedAt !== "number" || !Number.isFinite(g.endedAt) || g.endedAt < 0) return null;
  if (!s || typeof s !== "object" || (s.you !== "w" && s.you !== "b") || typeof s.startFen !== "string" || s.startFen.length > 100 || !/^[pnbrqkPNBRQK1-8/]+ [wb] /.test(s.startFen)) return null;
  const o = s.opponent as Record<string, unknown> | undefined;
  const opponent: StoredSetup["opponent"] | null = o?.kind === "bot" && typeof o.bot === "string" && BOT.test(o.bot) ? { kind: "bot", bot: o.bot } : o?.kind === "friend" ? { kind: "friend" } : o?.kind === "online" ? { kind: "online" } : null;
  if (!opponent) return null;
  if (!Array.isArray(g.history) || g.history.length > SAVED_GAME_MOVES_MAX || !g.history.every((m) => typeof m === "string" && SAN.test(m))) return null;
  if (g.winner !== "w" && g.winner !== "b" && g.winner !== null) return null;
  const reason = typeof g.reason === "string" && /^[a-z]{1,16}$/.test(g.reason) ? g.reason : "draw";
  const setup: StoredSetup = {
    opponent,
    you: s.you,
    time: typeof s.time === "string" && /^[a-z0-9+]{1,12}$/.test(s.time) ? s.time : "none",
    startFen: s.startFen,
    ...(typeof s.startName === "string" && s.startName.length <= 60 ? { startName: s.startName } : {}),
    ...(typeof s.startId === "string" && /^[a-z0-9-]{1,40}$/i.test(s.startId) ? { startId: s.startId } : {}),
    takebacks: s.takebacks === true,
    askPromotion: s.askPromotion !== false,
  };
  return { id: g.id, endedAt: Math.floor(g.endedAt), setup, history: [...(g.history as string[])], winner: g.winner as GameRecord["winner"], reason, ...(g.reviewed === true ? { reviewed: true } : {}) };
}

/** The device's games plus the account's, newest first. The device's copy of a game wins (it knows what was reviewed). */
export function mergeGameLogs(local: readonly GameRecord[], remote: readonly unknown[], max = GAME_LOG_MAX): GameRecord[] {
  const byId = new Map<string, GameRecord>();
  for (const raw of remote) {
    const g = sanitizeGameRecord(raw);
    if (g) byId.set(g.id, g);
  }
  for (const g of local) byId.set(g.id, { ...byId.get(g.id), ...g });
  return [...byId.values()].sort((a, b) => b.endedAt - a.endedAt).slice(0, max);
}

/** A finished friend challenge as a log entry (the friend's name is never stored). */
export function challengeRecord(c: { code: string; you: "w" | "b" | null; moves: readonly string[]; result: string | null; startFen?: string }, endedAt: number): GameRecord | null {
  if (!c.you || !c.moves.length) return null;
  const winner = c.result === "1-0" ? "w" : c.result === "0-1" ? "b" : null;
  return {
    id: `challenge:${c.code}`.slice(0, 80),
    endedAt,
    setup: { opponent: { kind: "online" }, you: c.you, time: "none", startFen: c.startFen ?? START_FEN, takebacks: false, askPromotion: true },
    history: [...c.moves],
    winner,
    reason: "challenge",
  };
}
