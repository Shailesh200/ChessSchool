import { NextRequest } from "next/server";
import { renderOgCard } from "@/lib/og/card";

export const runtime = "edge";

/** Dynamic Open Graph images for link previews (WhatsApp, Slack, Twitter, etc.). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "home";
  const titleParam = sp.get("title");
  const subtitleParam = sp.get("subtitle");
  const emoji = sp.get("emoji") ?? undefined;
  const badgeParam = sp.get("badge") ?? undefined;

  let title = titleParam ?? "Learn Chess Online";
  let subtitle =
    subtitleParam ?? "Free chess school — structured classes, puzzles, and live games.";
  let badge = badgeParam ?? "Chess School";
  let icon = emoji ?? "🎓";

  if (kind === "home") {
    title = titleParam ?? "Learn Chess Online";
    subtitle =
      subtitleParam ??
      "Free chess school with classes, puzzles, bots & live multiplayer.";
    badge = badgeParam ?? "Learn Chess";
    icon = emoji ?? "🎓";
  } else if (kind === "lesson") {
    badge = badgeParam ?? "Chess Lesson";
    icon = emoji ?? "♟️";
  } else if (kind === "class") {
    badge = badgeParam ?? "Chess Class";
    icon = emoji ?? "📚";
  } else if (kind === "game") {
    title = titleParam ?? "Join my live chess game";
    subtitle = subtitleParam ?? "Tap to play — real-time multiplayer on ChessSchool.";
    badge = badgeParam ?? "Live Game";
    icon = emoji ?? "⚔️";
  } else if (kind === "play") {
    title = titleParam ?? "Play Chess Online";
    subtitle = subtitleParam ?? "Bots, pass & play, and share-link multiplayer.";
    badge = badgeParam ?? "Play Chess";
    icon = emoji ?? "🏆";
  }

  return renderOgCard({ title, subtitle, badge, emoji: icon });
}
