import { createHash } from "node:crypto";
import { coachMoments, load, PIECE_NAMES, reviewPlies, type CoachMoment, type Color, type MistakeTag, type PieceType } from "@chessschool/chess";
import { coachOf, type CoachId } from "@chessschool/design";
import { eq, sql } from "drizzle-orm";
import type { AiProvider } from "./ai";
import type { Db } from "./db";
import { coachCache, coachUsage } from "./schema";

export const COACH_MAX_PLIES = 300;
export const COACH_USER_DAILY = 10;
export const COACH_GLOBAL_DAILY = 500;

export type CoachInput = { startFen: string; moves: string[]; side: Color | null; coach: CoachId };
export type CoachLang = "en" | "hi";
export type ExplainedMoment = Pick<CoachMoment, "ply" | "san" | "by" | "verdict" | "better" | "tags"> & { text: string };
export type CoachAnswer = { moments: ExplainedMoment[]; provider: string | null; cached: boolean };

/** A legal game of at most COACH_MAX_PLIES moves, or null. Only moves and the start position are read. */
export function parseCoachInput(b: { startFen?: unknown; moves?: unknown; side?: unknown; coach?: unknown }, isCoach: (v: unknown) => v is CoachId): CoachInput | null {
  if (typeof b.startFen !== "string" || b.startFen.length > 100 || !Array.isArray(b.moves) || b.moves.length > COACH_MAX_PLIES) return null;
  if (!b.moves.every((m) => typeof m === "string" && m.length <= 10)) return null;
  if (b.side !== "w" && b.side !== "b" && b.side !== null) return null;
  if (!isCoach(b.coach)) return null;
  try {
    const chess = load(b.startFen);
    if (!chess.fen().includes("K") || !chess.fen().split(" ")[0]!.includes("k")) return null;
  } catch {
    return null;
  }
  const moves = b.moves as string[];
  if (reviewPlies(b.startFen, moves).length !== moves.length) return null;
  return { startFen: b.startFen, moves, side: b.side, coach: b.coach };
}

const TAG_TEXT: Record<MistakeTag, string> = {
  hanging: "a piece was left unprotected where it could be taken",
  freePiece: "an unprotected enemy piece could have been taken for free",
  fork: "a fork: one piece attacking two things at once",
  pin: "a pin: a piece stuck in front of a more valuable one",
  mate: "a checkmate in this position",
  backRank: "a back-rank mate: the king was trapped behind its own pawns",
};
const VERDICT_TEXT = { inaccuracy: "a small slip", mistake: "a mistake", blunder: "a big mistake" } as const;

/** The system prompt and the facts. Nothing in either comes from the learner except their moves. */
export function coachPrompt(moments: CoachMoment[], coach: CoachId, lang: CoachLang, side: Color | null) {
  const c = coachOf(coach);
  const language =
    lang === "hi"
      ? "Write in simple Hindi (Devanagari). Address the learner as आप. Chess words: राजा king, रानी queen, हाथी rook, ऊँट bishop, घोड़ा knight, प्यादा pawn, शह check, शह-मात checkmate. Keep moves and squares in English letters, like Nf3 or e5."
      : "Write in simple English.";
  const system = [
    `You are ${c.name}, a chess coach for children aged 7 to 12. Your style: ${c.blurb.toLowerCase()}.`,
    "Explain each game moment in 2 or 3 short, warm, encouraging sentences: what happened, the better move by name, and what to look for next time.",
    "Use only the facts given. Never mention a square, piece or move that is not in that moment's facts. Do not invent names.",
    language,
    "Start each moment on its own line with its marker, like [1]. No headings, no lists, nothing else.",
  ].join(" ");
  const who = (by: Color) => (side ? (by === side ? "You" : "Your opponent") : by === "w" ? "White" : "Black");
  const lines = moments.map((m, i) => {
    const facts = [
      `Move ${m.moveNo}: ${who(m.by)} played ${m.san}, ${VERDICT_TEXT[m.verdict]}.`,
      m.better ? `A better move was ${m.better}.` : "",
      m.threat ? `It let the opponent play ${m.threat}.` : "",
      m.tags.length ? `The idea: ${m.tags.map((t) => TAG_TEXT[t]).join("; ")}.` : "",
      m.squares.length ? `Squares involved: ${m.squares.join(", ")}.` : "",
      m.pieces.length ? `Pieces involved: ${allowedPieces(m).map((p) => PIECE_NAMES[p]).join(", ")}.` : "",
    ];
    return `[${i + 1}] ${facts.filter(Boolean).join(" ")}`;
  });
  return { system, prompt: lines.join("\n") };
}

const SQUARE = /\b[a-h][1-8]\b/g;
const SAN = /\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)/g;
const PIECE_WORDS: [RegExp, PieceType][] = [
  [/\bkings?\b|राजा/i, "k"],
  [/\bqueens?\b|रानी|वज़ीर/i, "q"],
  [/\brooks?\b|हाथी/i, "r"],
  [/\bbishops?\b|ऊँट|ऊंट/i, "b"],
  [/\bknights?\b|घोड़/i, "n"],
  [/\bpawns?\b|प्याद/i, "p"],
];
const strip = (san: string) => san.replace(/[+#!?]/g, "");
const sansOf = (m: CoachMoment) => [m.san, m.better, m.threat].filter((s): s is string => Boolean(s));
const pieceOf = (san: string): PieceType => (san.startsWith("O-O") ? "k" : (({ K: "k", Q: "q", R: "r", B: "b", N: "n" }) as Record<string, PieceType>)[san[0]!] ?? "p");

function allowedPieces(m: CoachMoment): PieceType[] {
  const out = new Set<PieceType>([...m.pieces, ...sansOf(m).map(pieceOf)]);
  if (m.tags.includes("mate") || m.tags.includes("backRank") || m.tags.includes("fork") || m.tags.includes("pin") || sansOf(m).some((s) => /[+#]/.test(s))) out.add("k");
  return [...out];
}

/** True when the text names only squares, moves and pieces that are in the moment's facts. */
export function factCheck(text: string, m: CoachMoment): boolean {
  const sans = sansOf(m).map(strip);
  const squares = new Set([...m.squares, ...sans.flatMap((s) => s.match(/[a-h][1-8]/g) ?? [])]);
  const pieces = new Set(allowedPieces(m));
  if ((text.match(SQUARE) ?? []).some((sq) => !squares.has(sq))) return false;
  if ((text.match(SAN) ?? []).some((s) => !sans.includes(strip(s)))) return false;
  return PIECE_WORDS.every(([re, p]) => !re.test(text) || pieces.has(p));
}

/** Splits "[1] … [2] …" into one text per moment, or null when any is missing. */
export function splitAnswer(text: string, n: number): string[] | null {
  const parts = text.split(/\[(\d+)\]/);
  const out: string[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const k = Number(parts[i]) - 1;
    const body = parts[i + 1]!.replace(/[*_#]/g, "").replace(/\s+/g, " ").trim();
    if (k >= 0 && k < n && body && !out[k]) out[k] = body.slice(0, 500);
  }
  return out.length === n && out.every(Boolean) ? out : null;
}

/** Asks each provider in turn; the first answer that splits cleanly and passes the fact check wins. */
export async function askChain(providers: AiProvider[], moments: CoachMoment[], coach: CoachId, lang: CoachLang, side: Color | null): Promise<{ texts: string[]; provider: string } | null> {
  const { system, prompt } = coachPrompt(moments, coach, lang, side);
  for (const p of providers) {
    const raw = await p.complete(system, prompt).catch(() => null);
    const texts = raw ? splitAnswer(raw, moments.length) : null;
    if (texts && texts.every((t, i) => factCheck(t, moments[i]!))) return { texts, provider: p.name };
    console.warn(`[coach] ${p.name} answer ${raw ? "failed the fact check" : "missing"}`);
  }
  return null;
}

/**
 * Explains a game: the engine facts are recomputed here, explanations are cached by
 * (facts, coach, language), and only cache misses count toward the daily caps.
 * Returns "limit" when a cap is reached and null when no provider gave a usable answer.
 */
export async function explainGame(db: Db, providers: AiProvider[], input: CoachInput, lang: CoachLang, userId: string, day: string, now: number): Promise<CoachAnswer | "limit" | null> {
  const moments = coachMoments(input.startFen, input.moves, input.side);
  const shape = (texts: string[]) => moments.map((m, i) => ({ ply: m.ply, san: m.san, by: m.by, verdict: m.verdict, better: m.better, tags: m.tags, text: texts[i]! }));
  if (!moments.length) return { moments: [], provider: null, cached: false };
  const key = createHash("sha256").update(JSON.stringify({ moments, coach: input.coach, lang, side: input.side })).digest("hex");
  const hit = await db.query.coachCache.findFirst({ where: eq(coachCache.key, key) });
  if (hit) return { moments: shape(JSON.parse(hit.texts) as string[]), provider: hit.provider, cached: true };

  const mine = await db.query.coachUsage.findFirst({ where: sql`${coachUsage.userId} = ${userId} AND ${coachUsage.day} = ${day}` });
  const all = await db.select({ n: sql<number>`coalesce(sum(${coachUsage.count}), 0)` }).from(coachUsage).where(eq(coachUsage.day, day)).get();
  if ((mine?.count ?? 0) >= COACH_USER_DAILY || Number(all?.n ?? 0) >= COACH_GLOBAL_DAILY) return "limit";
  await db.insert(coachUsage).values({ userId, day, count: 1 }).onConflictDoUpdate({ target: [coachUsage.userId, coachUsage.day], set: { count: sql`${coachUsage.count} + 1` } });

  const got = await askChain(providers, moments, input.coach, lang, input.side);
  if (!got) return null;
  await db.insert(coachCache).values({ key, texts: JSON.stringify(got.texts), provider: got.provider, createdAt: now }).onConflictDoNothing();
  return { moments: shape(got.texts), provider: got.provider, cached: false };
}
