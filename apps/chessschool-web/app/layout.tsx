import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Baloo_2, Fredoka } from "next/font/google";
import { boardColorPalettes, copy, cssVars, palettes, THEMES, themePalettes } from "@chessschool/design";
import { AppStateProvider } from "@/lib/state";
import { themeBootScript } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";
import { GuestGateHost } from "@/components/PathList";
import { PuzzlePackBoot } from "@/components/PuzzlePackBoot";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ScreenViews } from "@/components/ScreenViews";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fredoka", display: "swap" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap", preload: false });
const baloo = Baloo_2({ subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-baloo", display: "swap", preload: false });

export const metadata: Metadata = {
  // Link previews need an absolute, public image URL; the live site has no NEXT_PUBLIC_APP_URL set.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://www.chess-school.in"),
  title: { default: copy.brand, template: `%s · ${copy.brand}` },
  description: copy.tagline,
  applicationName: copy.brand,
  appleWebApp: { capable: true, title: copy.brand, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/assets/raster/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/assets/raster/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/assets/raster/apple-touch-icon.png",
  },
  openGraph: { title: copy.brand, description: copy.tagline, images: ["/assets/raster/og.png"], type: "website" },
  twitter: { card: "summary_large_image", title: copy.brand, description: copy.tagline, images: ["/assets/raster/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: palettes.light.bg },
    { media: "(prefers-color-scheme: dark)", color: palettes.dark.bg },
  ],
};

// Light by default, dark when the OS asks (unless the learner picked one), forced by data-theme.
const themeCss = THEMES.filter((t) => t.id !== "classroom")
  .map((t) => `:root[data-cs-theme="${t.id}"]{${cssVars(themePalettes[t.id as keyof typeof themePalettes])}color-scheme:${t.scheme}}`)
  .join("\n");
// Colour-blind friendly boards override only the board variables, on top of any theme.
const boardCss = Object.entries(boardColorPalettes)
  .map(([id, b]) => `:root[data-cs-board="${id}"]{${cssVars(b)}}`)
  .join("\n");
const tokenCss = `:root{${cssVars("light")}color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${cssVars("dark")}color-scheme:dark}}
:root[data-theme="dark"]{${cssVars("dark")}color-scheme:dark}
${themeCss}
${boardCss}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-cs-theme="sunset" className={`${fredoka.variable} ${baloo.variable} ${atkinson.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <style dangerouslySetInnerHTML={{ __html: tokenCss }} />
      </head>
      <body>
        <AppStateProvider>
          <PuzzlePackBoot />
          <ScreenViews />
          <ToastProvider>
            {children}
            <GuestGateHost />
          </ToastProvider>
        </AppStateProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
