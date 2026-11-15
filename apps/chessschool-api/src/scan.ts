import Anthropic from "@anthropic-ai/sdk";
import { placementFromRanks, setupFen, setupProblem, type ScannedBoard } from "@chessschool/chess";
import { eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { scanUsage } from "./schema";

export const SCAN_USER_DAILY = 10;
// A photo can cost up to ~$0.33 at high effort (scanner trial), so the shared cap stays small.
export const SCAN_GLOBAL_DAILY = 50;
/** Base64 characters (about 1.1 MB of image). The apps downscale to 1024 px first. */
export const SCAN_MAX_BASE64 = 1_500_000;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ScanImage = { data: string; mediaType: (typeof MEDIA_TYPES)[number] };

/** Reads a board photo or diagram. Null on any failure. The image is passed through, never stored. */
export type BoardReader = (image: ScanImage) => Promise<ScannedBoard | null>;

const PROMPT = `This image shows a chess position: a photo of a real board or a printed/screen diagram.
Read the position square by square. Work out the board's orientation first: use printed coordinates (a-h, 1-8) if visible; otherwise assume White plays up from the bottom of a diagram. In photos, the board may be seen from any side.
Return "ranks": exactly 8 strings, rank 8 first down to rank 1. Each string has exactly 8 characters for files a to h: K Q R B N P for White pieces, k q r b n p for Black pieces, "." for an empty square.
Return "side_to_move": "w" or "b" if the image shows it (an arrow, a caption like "White to play"), else "unknown".
Return "confidence": your overall confidence from 0 to 1 that every square is right.
If the image is not a chess board, return 8 ranks of dots and confidence 0.`;

const SCHEMA = {
  type: "object",
  properties: {
    ranks: { type: "array", items: { type: "string" } },
    side_to_move: { type: "string", enum: ["w", "b", "unknown"] },
    confidence: { type: "number" },
  },
  required: ["ranks", "side_to_move", "confidence"],
  additionalProperties: false,
} as const;

/** The language model chosen in the scanner trial (see scanner-trial/RESULTS.md): high effort reads photos, not just diagrams. */
export function anthropicBoardReader(key: string | undefined, model = "claude-opus-5-5"): BoardReader | null {
  if (!key) return null;
  const client = new Anthropic({ apiKey: key, timeout: 150_000, maxRetries: 0 });
  return async (image) => {
    try {
      const msg = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }, { type: "text", text: PROMPT }] }],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
      // Token counts only, for keeping an eye on spend.
      console.info(`[scan] ${model} in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}`);
      if (msg.stop_reason !== "end_turn") return null;
      const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const out = JSON.parse(text) as { ranks?: unknown; side_to_move?: unknown; confidence?: unknown };
      return {
        ranks: Array.isArray(out.ranks) ? (out.ranks as string[]) : [],
        side: out.side_to_move === "w" || out.side_to_move === "b" ? out.side_to_move : null,
        confidence: typeof out.confidence === "number" ? Math.max(0, Math.min(1, out.confidence)) : 0,
      };
    } catch (err) {
      console.warn(`[scan] ${model} failed: ${err instanceof Anthropic.APIError ? (err.status ?? "network") : (err as Error).name}`);
      return null;
    }
  };
}

/** Checks the request body: a base64 image of an allowed type, under the size cap. */
export function parseScanImage(b: { image?: unknown; mediaType?: unknown }): ScanImage | null {
  if (typeof b.image !== "string" || !b.image || b.image.length > SCAN_MAX_BASE64 || !/^[A-Za-z0-9+/]+=*$/.test(b.image)) return null;
  if (!MEDIA_TYPES.includes(b.mediaType as ScanImage["mediaType"])) return null;
  return { data: b.image, mediaType: b.mediaType as ScanImage["mediaType"] };
}

export type ScanAnswer = { placement: string; fen: string; side: "w" | "b" | null; confidence: number; problem: ReturnType<typeof setupProblem> };

/**
 * One scan: daily caps (per learner and for everyone), then the reader. The answer is a starting point
 * the learner edits, so a position chess.js rejects still comes back, with the reason in `problem`.
 */
export async function scanBoard(db: Db, reader: BoardReader, image: ScanImage, userId: string, day: string): Promise<ScanAnswer | "limit" | null> {
  const mine = await db.query.scanUsage.findFirst({ where: sql`${scanUsage.userId} = ${userId} AND ${scanUsage.day} = ${day}` });
  const all = await db.select({ n: sql<number>`coalesce(sum(${scanUsage.count}), 0)` }).from(scanUsage).where(eq(scanUsage.day, day)).get();
  if ((mine?.count ?? 0) >= SCAN_USER_DAILY || Number(all?.n ?? 0) >= SCAN_GLOBAL_DAILY) return "limit";
  await db.insert(scanUsage).values({ userId, day, count: 1 }).onConflictDoUpdate({ target: [scanUsage.userId, scanUsage.day], set: { count: sql`${scanUsage.count} + 1` } });
  const board = await reader(image);
  const placement = board && placementFromRanks(board.ranks);
  if (!board || !placement || placement === "8/8/8/8/8/8/8/8") return null;
  const fen = setupFen(placement, board.side ?? "w");
  return { placement, fen, side: board.side, confidence: board.confidence, problem: setupProblem(fen) };
}
