// Design tokens ported 1:1 from the web app's @theme (app/globals.css) so the
// mobile UI matches web colors, radii, elevation, and the Fredoka typeface.

export const colors = {
  brand50: "#eef0ff",
  brand100: "#dfe3ff",
  brand300: "#aab2ff",
  brand: "#5b5bd6",
  brand600: "#4b46c4",
  brand700: "#3b35a0",
  accent400: "#ff9a76",
  accent: "#ff7a59",
  accent600: "#f2613f",
  success400: "#34d399",
  success: "#10b981",
  /** Web --success-600 */
  success600: "#059669",
  danger400: "#fb7185",
  danger: "#f43f5e",
  /** Web danger button edge */
  danger700: "#be123c",
  warning400: "#fbbf24",
  warning: "#f59e0b",
  gold: "#f6c343",
  ink: "#1c1b2e",
  ink700: "#3a3850",
  ink500: "#6b6982",
  ink300: "#a9a7bd",
  surface: "#fbfaff",
  surfaceCard: "#ffffff",
  surfaceSunken: "#f1f0f9",
  hairline: "#e7e6f2",
} as const;

/** rem → px at 16px root: sm=8, md=14, lg/card=20, xl=28, pill=999 */
export const radius = { sm: 8, md: 14, card: 20, xl: 28, pill: 999 } as const;

// Web's Tailwind spacing scale (4px base) — px-4 = 16, gap-5 = 20, etc.
export const space = { 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

// Tailwind type scale aligned with web (text-xs … text-3xl).
export const type = {
  caption: { fontSize: 11, lineHeight: 15 },
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 26 },
  xl: { fontSize: 20, lineHeight: 28 },
  "2xl": { fontSize: 24, lineHeight: 32 },
  "3xl": { fontSize: 28, lineHeight: 34 },
} as const;

// Fredoka weight variants (custom fonts use family-per-weight, not fontWeight).
export const font = {
  regular: "Fredoka_400Regular",
  medium: "Fredoka_500Medium",
  semibold: "Fredoka_600SemiBold",
  bold: "Fredoka_700Bold",
} as const;

/** Web --elev-2 / --shadow-card */
export const shadowCard = {
  shadowColor: "#1c1b2e",
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

/** Web --elev-1 */
export const shadowElev1 = {
  shadowColor: "#1c1b2e",
  shadowOpacity: 0.06,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

/** Web --elev-3 */
export const shadowElev3 = {
  shadowColor: "#1c1b2e",
  shadowOpacity: 0.16,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
} as const;

/** Web button heights: sm h-11=44, md h-12=48, lg h-14=56 */
export const buttonHeight = { sm: 44, md: 48, lg: 56 } as const;
