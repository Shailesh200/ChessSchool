import { NextResponse } from "next/server";
import { revokeToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Revoke the bearer token (mobile logout). */
export async function POST(req: Request) {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) await revokeToken(h.slice(7));
  return NextResponse.json({ ok: true });
}
