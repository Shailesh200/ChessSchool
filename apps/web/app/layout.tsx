import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/providers/ClientProviders";

const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chess-school.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "ChessSchool",
  title: {
    default: "ChessSchool — Become a stronger player",
    template: "%s · ChessSchool",
  },
  description:
    "A school-first chess academy: graduate through classes, master openings and endgames, play adaptive bots, and review every game. Offline-first PWA with accounts and progress sync.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ChessSchool" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "ChessSchool",
    title: "ChessSchool — Become a stronger player",
    description: "Graduate through chess classes, puzzles, and matches.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "ChessSchool" }],
  },
  twitter: {
    card: "summary",
    title: "ChessSchool",
    description: "Graduate through chess classes, puzzles, and matches.",
    images: ["/icons/icon-512.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-icon-180.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#5b5bd6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} h-full`}>
      <body className="min-h-full">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
