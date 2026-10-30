import type { Metadata } from "next";
import { pageSocialMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Play Chess Online — Bots & Live Multiplayer",
    description:
      "Play chess online at ChessSchool — adaptive bots by ELO, pass & play, and share-link live games with clocks. Free, no download required.",
    ...(await pageSocialMeta({
      title: "Play Chess Online",
      description: "Adaptive bots, pass & play, and live share-link multiplayer.",
      path: "/play",
      kind: "play",
      badge: "Play Chess",
      emoji: "🏆",
    })),
  };
}

export default function PlayTabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
