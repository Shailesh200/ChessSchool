import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { synthesizeCoachSpeech, ttsConfigured } from "@/lib/tts/synthesize.server";

import { COACH_VOICE_IDS } from "@/lib/tts/voices";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
  personality: z.enum(["friendly", "strict", "mentor", "tactical", "minimal"]),
  voice: z.enum(COACH_VOICE_IDS).optional().default("auto"),
});

/** Cloud TTS for coach / bot chat bubbles (Edge by default; Google optional). */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  const limited = enforceRateLimit(
    req,
    "tts",
    user ? { limit: 90, windowMs: 60_000 } : { limit: 24, windowMs: 60_000 },
    user?.id,
  );
  if (limited) return limited;

  if (!ttsConfigured()) {
    return NextResponse.json({ error: "tts_unconfigured" }, { status: 503 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const audio = await synthesizeCoachSpeech(body.text, body.personality, body.voice);
  if (!audio) {
    return NextResponse.json({ error: "synthesis_failed" }, { status: 502 });
  }

  return new NextResponse(new Uint8Array(audio), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
