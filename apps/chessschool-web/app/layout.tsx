import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import { copy, cssVars, palettes, THEMES, themePalettes } from "@chessschool/design";
import { AppStateProvider } from "@/lib/state";
import { themeBootScript } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";
import { GuestGateHost } from "@/components/PathList";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fredoka", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"),
  title: { default: copy.brand, template: `%s · ${copy.brand}` },
  description: copy.tagline,
  applicationName: copy.brand,
  appleWebApp: { capable: true, title: copy.brand, statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/assets/raster/favicon-48.png", sizes: "48x48" }],
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
const tokenCss = `:root{${cssVars("light")}color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${cssVars("dark")}color-scheme:dark}}
:root[data-theme="dark"]{${cssVars("dark")}color-scheme:dark}
${themeCss}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fredoka.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <style dangerouslySetInnerHTML={{ __html: tokenCss }} />
      </head>
      <body>
        <AppStateProvider>
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
