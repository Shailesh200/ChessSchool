/** Premium illustrated tokens (--cs-* light theme). Swappable with dex-mobile-kit later. */

export const premiumColors = {
  bg: "#FFF9F0",
  bgSplash: "#FFF9F0",
  bgSunken: "#F6EFE2",
  surface: "#FFFFFF",
  surfaceSoft: "#BFE8D2",
  surfaceMuted: "#F6EFE2",
  line: "#EAE5DA",
  lineStrong: "#DCD6C9",
  text: "#1F2B2D",
  textMuted: "#53615D",
  textSubtle: "#7B8A88",
  textOnBrand: "#FFFFFF",
  textOnAccent: "#1F2B2D",
  textLink: "#0F6B54",
  brand: "#0F6B54",
  brandEdge: "#0B4A3B",
  brandSoft: "#BFE8D2",
  brandSoftText: "#0B4A3B",
  brandOnSoftIcon: "#0F6B54",
  accent: "#FF7A59",
  accentEdge: "#D95A3B",
  accentSoft: "#FFE2D9",
  accentSoftText: "#8A2E14",
  success: "#0F6B54",
  successSoft: "#BFE8D2",
  successText: "#0B4A3B",
  error: "#C9411D",
  errorSoft: "#FFC9B8",
  errorText: "#6B1E0B",
  errorEdge: "#8F2A10",
  warningSoft: "#FFE9B8",
  warningText: "#6B4A00",
  xp: "#FFC857",
  streak: "#FF7A59",
  streakText: "#C2410C",
  coachBubble: "#FFFFFF",
  tabActiveBg: "#BFE8D2",
  tabActiveFg: "#0B4A3B",
  boardLight: "#EBF5EA",
  boardDark: "#7DB89A",
  boardFrame: "#0F6B54",
  heroBg: "#0F6B54",
  heroTx: "#FFFFFF",
  heroSub: "#BFE8D2",
  overlay: "rgba(20,29,31,0.48)",
} as const;

export const premiumSpace = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const premiumRadius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  x2: 28,
  pill: 999,
} as const;

export const premiumFont = {
  display: "Fredoka_700Bold",
  ui: "Fredoka_500Medium",
  uiBold: "Fredoka_700Bold",
} as const;

export const premiumType = {
  h1: { fontSize: 30, lineHeight: 34 },
  h2: { fontSize: 24, lineHeight: 28 },
  h3: { fontSize: 20, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyLg: { fontSize: 17, lineHeight: 25 },
  caption: { fontSize: 12, lineHeight: 16 },
  button: { fontSize: 17, lineHeight: 20 },
} as const;

export const premiumShadowEdge = {
  shadowColor: premiumColors.brandEdge,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
} as const;
