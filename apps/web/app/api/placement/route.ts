import { NextResponse } from "next/server";
import { getPlacementPuzzles } from "@/lib/placement-pool";

export const revalidate = 3600;

/** ~8 increasingly-spread move puzzles for the placement test. */
export async function GET() {
  const puzzles = await getPlacementPuzzles();
  return NextResponse.json({ puzzles });
}
