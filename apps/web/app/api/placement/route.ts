import { NextResponse } from "next/server";
import { db } from "@/db";
import { lessons } from "@/db/schema";

export const dynamic = "force-dynamic";

/** ~8 increasingly-spread move puzzles for the mobile placement test. */
export async function GET() {
  const rows = await db.select({ steps: lessons.steps }).from(lessons).limit(600);
  const all: { fen: string; solution: string[] }[] = [];
  for (const r of rows) {
    try {
      for (const s of JSON.parse(r.steps) as { kind?: string; fen?: string; solution?: string[] }[]) {
        if (s.kind === "move" && s.fen && s.solution && s.solution.length) {
          all.push({ fen: s.fen, solution: s.solution });
          break;
        }
      }
    } catch {
      /* skip */
    }
    if (all.length >= 240) break;
  }
  const stride = Math.max(1, Math.floor(all.length / 8));
  const puzzles: { fen: string; solution: string[] }[] = [];
  for (let i = 0; i < all.length && puzzles.length < 8; i += stride) puzzles.push(all[i]!);
  return NextResponse.json({ puzzles });
}
