import { createHash } from "node:crypto";
import { botInfo, coachMoments, isBotId, load, PIECE_NAMES, type BotId, type CoachMoment, type Color, type PieceType } from "@chessschool/chess";
import { coachOf, type CoachId } from "@chessschool/design";
import { eq, sql } from "drizzle-orm";
import type { AiProvider } from "./ai";
import { askChain, factCheck, type CoachLang } from "./coach";
import type { Db } from "./db";
import { coachCache, coachUsage } from "./schema";

/**
 * Short AI lines during a bot game: why the hint move is good, a comment on the learner's mistake,
 * and the bot's own choice among the moves its rating model offered (with an optional remark).
 * Providers only see moves and engine facts. Usage is counted in cs_coach_usage under "<day>/line"
 * and "<day>/bot", apart from game explanations.
 */
export const LINE_USER_DAILY = 150;
export const LINE_GLOBAL_DAILY = 20_000;
export const BOT_USER_DAILY = 800;
export const BOT_GLOBAL_DAILY = 100_000;
export const BOT_MAX_OPTIONS = 5;
/** Hints use the paid model (Haiku) first, up to these caps; past them, the free providers. */
export const HINT_PAID_USER_DAILY = 30;
export const HINT_PAID_GLOBAL_DAILY = 400;

export type LineInput =
  | { kind: "hint" | "comment"; fen: string; move: string; coach: CoachId }
  | { kind: "bot"; fen: string; bot: BotId; options: string[] };
export type LineAnswer = { text: string | null } | { pick: number; say: string | null };

type Legal = { san: string; from: string; to: string; piece: PieceType; captured?: PieceType; check: boolean };

function legalMove(fen: string, san: string): Legal | null {
  try {
    const m = load(fen).move(san);
    return { san: m.san, from: m.from, to: m.to, piece: m.piece as PieceType, captured: m.captured as PieceType | undefined, check: /[+#]$/.test(m.san) };
  } catch {
    return null;
  }
}

/** Validates the body: a legal position and legal moves in it; nothing else is read. */
export function parseLineInput(b: Record<string, unknown>, isCoach: (v: unknown) => v is CoachId): LineInput | null {
  if (typeof b.fen !== "string" || b.fen.length > 100) return null;
  try {
    load(b.fen);
  } catch {
    return null;
  }
  if ((b.kind === "hint" || b.kind === "comment") && typeof b.move === "string" && b.move.length <= 10 && isCoach(b.coach)) {
    return legalMove(b.fen, b.move) ? { kind: b.kind, fen: b.fen, move: b.move, coach: b.coach } : null;
  }
  if (b.kind === "bot" && isBotId(b.bot) && Array.isArray(b.options) && b.options.length >= 2 && b.options.length <= BOT_MAX_OPTIONS) {
    const options = b.options.filter((o): o is string => typeof o === "string" && o.length <= 10);
    return options.length === b.options.length && options.every((o) => legalMove(b.fen as string, o)) ? { kind: "bot", fen: b.fen, bot: b.bot, options } : null;
  }
  return null;
}

const turnOf = (fen: string): Color => (fen.split(" ")[1] === "b" ? "b" : "w");
const moveNoOf = (fen: string) => Math.max(1, Number(fen.split(" ")[5]) || 1);

/** Facts for the hint move, shaped like a coach moment so the same fact check applies. */
function hintFacts(fen: string, m: Legal): CoachMoment {
  const after = load(fen);
  after.move(m.san);
  const them = turnOf(fen) === "w" ? "b" : "w";
  // Enemy pieces (not pawns) under attack after the move: what the move threatens.
  const targets: { sq: string; p: PieceType }[] = [];
  const board = after.board();
  for (const row of board) for (const cell of row) if (cell && cell.color === them && cell.type !== "p" && after.isAttacked(cell.square, turnOf(fen))) targets.push({ sq: cell.square, p: cell.type as PieceType });
  const tags: CoachMoment["tags"] = [];
  if (after.isCheckmate()) tags.push("mate");
  return {
    ply: 0,
    moveNo: moveNoOf(fen),
    by: turnOf(fen),
    san: m.san,
    verdict: "inaccuracy",
    loss: 0,
    better: null,
    threat: null,
    tags,
    squares: [m.from, m.to, ...targets.map((t) => t.sq)],
    pieces: [m.piece, ...(m.captured ? [m.captured] : []), ...targets.map((t) => t.p)],
  } as CoachMoment;
}

function hintPrompt(f: CoachMoment, m: Legal, coach: CoachId, lang: CoachLang) {
  const c = coachOf(coach);
  const facts = [
    `The suggested move is ${m.san}: the ${PIECE_NAMES[m.piece]} goes from ${m.from} to ${m.to}.`,
    m.captured ? `It captures a ${PIECE_NAMES[m.captured]}.` : "",
    f.tags.includes("mate") ? "It is checkmate." : m.check ? "It gives check." : "",
    f.pieces.length > 1 + (m.captured ? 1 : 0) ? `After it, the ${PIECE_NAMES[m.piece]} attacks: ${f.pieces.slice(1 + (m.captured ? 1 : 0)).map((p, i) => `${PIECE_NAMES[p]} on ${f.squares[2 + i]}`).join(", ")}.` : "",
  ].filter(Boolean);
  const system = [
    `You are ${c.name}, a chess coach for children aged 7 to 12. Your style: ${c.blurb.toLowerCase()}.`,
    "Give a hint in ONE short, warm sentence (at most 20 words) that names the concrete idea from the facts: checkmate, check, a capture, or which piece it attacks. Do not just say it is good.",
    "Use only the facts given. Never mention a square, piece or move that is not in the facts.",
    lang === "hi" ? "Write in simple, natural Hindi (Devanagari) with आप-form verbs; do not start with आप. Chess words: राजा, रानी, हाथी, ऊँट, घोड़ा, प्यादा, शह, शह-मात. Keep moves and squares in English letters." : "Write in simple English.",
  ].join(" ");
  return { system, prompt: facts.join(" ") };
}

async function countUse(db: Db, userId: string, day: string, userCap: number, globalCap: number): Promise<boolean> {
  const mine = await db.query.coachUsage.findFirst({ where: sql`${coachUsage.userId} = ${userId} AND ${coachUsage.day} = ${day}` });
  const all = await db.select({ n: sql<number>`coalesce(sum(${coachUsage.count}), 0)` }).from(coachUsage).where(eq(coachUsage.day, day)).get();
  if ((mine?.count ?? 0) >= userCap || Number(all?.n ?? 0) >= globalCap) return false;
  await db.insert(coachUsage).values({ userId, day, count: 1 }).onConflictDoUpdate({ target: [coachUsage.userId, coachUsage.day], set: { count: sql`${coachUsage.count} + 1` } });
  return true;
}

const oneLine = (raw: string) => raw.replace(/[*_#"]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);

/** One coach line for a hint or a learner's mistake; `text: null` when the move needs no comment. Cached by facts. */
async function coachLine(db: Db, providers: AiProvider[], input: Extract<LineInput, { coach: CoachId }>, lang: CoachLang, userId: string, day: string, now: number): Promise<LineAnswer | "limit" | null> {
  const side = turnOf(input.fen);
  const free = providers.filter((p) => p.name !== "anthropic");
  let fact: CoachMoment;
  let ask: () => Promise<{ text: string; provider: string } | null>;
  if (input.kind === "comment") {
    const [moment] = coachMoments(input.fen, [input.move], side, 1);
    // Only real mistakes get a comment; a good move or a small slip passes quietly.
    if (!moment || moment.verdict === "inaccuracy") return { text: null };
    fact = { ...moment, moveNo: moveNoOf(input.fen) };
    ask = async () => {
      const got = await askChain(free, [fact], input.coach, lang, side);
      // Mid-game the line must stay short: what happened and the better move.
      return got ? { text: got.texts[0]!.split(/(?<=[.!?।])\s+/).slice(0, 2).join(" "), provider: got.provider } : null;
    };
  } else {
    const m = legalMove(input.fen, input.move)!;
    fact = hintFacts(input.fen, m);
    const { system, prompt } = hintPrompt(fact, m, input.coach, lang);
    ask = async () => {
      const paid = providers.find((p) => p.name === "anthropic");
      const chain = paid && (await countUse(db, userId, `${day}/hint-paid`, HINT_PAID_USER_DAILY, HINT_PAID_GLOBAL_DAILY)) ? [paid, ...free] : free;
      for (const p of chain) {
        const raw = await p.complete(system, prompt).catch(() => null);
        const text = raw ? oneLine(raw) : "";
        if (text && factCheck(text, fact)) return { text, provider: p.name };
      }
      return null;
    };
  }
  const key = createHash("sha256").update(JSON.stringify({ line: input.kind, fact, coach: input.coach, lang })).digest("hex");
  const hit = await db.query.coachCache.findFirst({ where: eq(coachCache.key, key) });
  if (hit) return { text: (JSON.parse(hit.texts) as string[])[0] ?? null };
  if (!(await countUse(db, userId, `${day}/line`, LINE_USER_DAILY, LINE_GLOBAL_DAILY))) return "limit";
  const got = await ask();
  if (!got) return null;
  await db.insert(coachCache).values({ key, texts: JSON.stringify([got.text]), provider: got.provider, createdAt: now }).onConflictDoNothing();
  return { text: got.text };
}

/** Parses "2 | Nice, a free knight!" or "2"; the remark may name only the chosen move. */
export function parseBotAnswer(raw: string, options: string[]): { pick: number; say: string | null } | null {
  const m = raw.trim().match(/^\D*?(\d+)\s*(?:[|:.)\-–—]\s*(.*))?$/s);
  if (!m) return null;
  const pick = Number(m[1]) - 1;
  if (!(pick >= 0 && pick < options.length)) return null;
  let say: string | null = m[2] ? oneLine(m[2]).slice(0, 90) : null;
  if (say) {
    const chosen = options[pick]!.replace(/[+#]/g, "");
    const squares = new Set(chosen.match(/[a-h][1-8]/g) ?? []);
    const named = say.match(/\b[a-h][1-8]\b/g) ?? [];
    if (named.some((s) => !squares.has(s))) say = null;
  }
  return { pick, say: say || null };
}

/** The bot picks among the moves its rating model offered, in its own style. Not cached: it should feel alive. */
async function botPick(db: Db, providers: AiProvider[], input: Extract<LineInput, { kind: "bot" }>, lang: CoachLang, userId: string, day: string): Promise<LineAnswer | "limit" | null> {
  if (!(await countUse(db, userId, `${day}/bot`, BOT_USER_DAILY, BOT_GLOBAL_DAILY))) return "limit";
  const bot = botInfo(input.bot);
  const options = input.options.map((san, i) => {
    const m = legalMove(input.fen, san)!;
    const what = [`${PIECE_NAMES[m.piece]} to ${m.to}`, m.captured ? `captures a ${PIECE_NAMES[m.captured]}` : "", m.check ? "gives check" : ""].filter(Boolean).join(", ");
    return `${i + 1}) ${m.san} (${what})`;
  });
  const system = [
    `You are ${bot.name}, a friendly chess bot playing a child. Your style: ${bot.blurb}.`,
    "Choose ONE of the numbered moves that best fits your style. Reply with the number only.",
    "If your move captures or gives check, you may add a short, kind, playful remark after a | (at most 10 words, no other moves or squares).",
    lang === "hi" ? "Write any remark in simple Hindi (Devanagari)." : "Write any remark in simple English.",
  ].join(" ");
  for (const p of providers.filter((x) => x.name !== "anthropic")) {
    const raw = await p.complete(system, options.join("\n")).catch(() => null);
    const got = raw ? parseBotAnswer(raw, input.options) : null;
    // A remark only fits a capture or a check (models add one anyway).
    if (got) return /x|[+#]/.test(input.options[got.pick]!) ? got : { pick: got.pick, say: null };
  }
  return null;
}

export async function answerLine(db: Db, providers: AiProvider[], input: LineInput, lang: CoachLang, userId: string, day: string, now: number): Promise<LineAnswer | "limit" | null> {
  return input.kind === "bot" ? botPick(db, providers, input, lang, userId, day) : coachLine(db, providers, input, lang, userId, day, now);
}
