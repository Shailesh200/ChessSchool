import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { ConsentedTelemetry } from "@/components/providers/ConsentedTelemetry";
import { THEME_BOOTSTRAP_SCRIPT } from "@/core/bootstrap/themeBootstrapScript";
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  SEO_KEYWORDS,
  siteName,
  siteUrl,
  socialMeta,
} from "@/lib/seo";

// Latin variable face. Weights 400–700 are the ones the UI uses
// (body, font-medium, font-semibold, font-bold). No Google fetch.
const fredoka = localFont({
  src: "./fonts/Fredoka-latin.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  // Metric-matched fallback: swap in the font without shifting the layout.
  adjustFontFallback: "Arial",
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-display",
});

const rootSocial = socialMeta({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
  kind: "home",
  badge: "Learn Chess",
  emoji: "🎓",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: HOME_TITLE,
    template: `%s · ${siteName}`,
  },
  description: HOME_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: siteName },
  formatDetection: { telephone: false },
  ...rootSocial,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F6B54",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Resize the layout viewport with the keyboard so a bottom sheet stays above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} h-full`} suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full">
        <ClientProviders>{children}</ClientProviders>
        <ConsentedTelemetry />
      </body>
    </html>
  );
}
