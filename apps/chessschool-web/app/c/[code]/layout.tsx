import type { Metadata } from "next";

/** What a challenge link shows in WhatsApp, iMessage and the like (the page itself is client-side). */
export const metadata: Metadata = {
  title: "Can you beat me? · ChessSchool",
  description: "A chess challenge from a friend. Play it right in your browser, no account needed.",
  openGraph: { title: "Can you beat me?", description: "A chess challenge from a friend on ChessSchool. No account needed.", images: ["/assets/raster/og.png"] },
};

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
