import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { siteName, socialMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = (
    await db
      .select({
        status: gameSessions.status,
        timeControlMin: gameSessions.timeControlMin,
        blackJoined: gameSessions.blackJoined,
      })
      .from(gameSessions)
      .where(eq(gameSessions.id, id))
      .limit(1)
  )[0];

  const mins = row?.timeControlMin ?? 10;
  const waiting = !row || row.status === "waiting";
  const title = waiting ? "Join my chess game" : "Live chess match";
  const description = waiting
    ? `${mins}-minute live game on ${siteName} — tap to join as Black and play now.`
    : `Watch or rejoin this ${mins}-minute chess match on ${siteName}.`;

  return {
    title,
    description,
    ...socialMeta({
      title: `${title} · ${siteName}`,
      description,
      path: `/play/online/${id}`,
      kind: "game",
      badge: waiting ? "You're invited" : "Live Game",
      emoji: waiting ? "⚔️" : "♟️",
      imageTitle: waiting ? "Join my live chess game" : "ChessSchool live match",
      imageSubtitle: description,
    }),
  };
}

export default function OnlineGameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
