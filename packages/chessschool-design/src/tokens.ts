/**
 * ChessSchool design tokens. Values come from the production indigo kit
 * (light) and its "midnight" theme (dark). Every text/background pair used by
 * the apps is checked in tokens.test.ts against WCAG AA.
 */

export type Scheme = "light" | "dark";
export type Appearance = "system" | Scheme;

export type Palette = {
  /** App background */
  bg: string;
  /** Cards, sheets, tab bar */
  card: string;
  /** Inset wells, segmented controls, progress tracks */
  sunken: string;
  /** Hairline borders and dividers */
  line: string;
  text: string;
  textMuted: string;
  /** Placeholders, disabled labels (decorative only, not body text) */
  textSubtle: string;
  brand: string;
  /** Pressed edge under brand buttons */
  brandEdge: string;
  /** Tinted brand surfaces (chips, selected rows) */
  brandSoft: string;
  /** Brand-coloured text on bg/card */
  brandText: string;
  onBrand: string;
  accent: string;
  accentEdge: string;
  onAccent: string;
  success: string;
  successText: string;
  successSoft: string;
  danger: string;
  dangerText: string;
  dangerSoft: string;
  gold: string;
  goldText: string;
  goldSoft: string;
  /** Scrim behind sheets/dialogs */
  scrim: string;
  /** Focus ring */
  focus: string;
  /** Hero gradient stops */
  heroFrom: string;
  heroTo: string;
  /** Chessboard */
  boardLight: string;
  boardDark: string;
  boardSelect: string;
  boardMove: string;
  boardHint: string;
  boardCheck: string;
  boardDot: string;
  boardCoordOnLight: string;
  boardCoordOnDark: string;
};

export const palettes: Record<Scheme, Palette> = {
  light: {
    bg: "#FBFAFF",
    card: "#FFFFFF",
    sunken: "#F1F0F9",
    line: "#E7E6F2",
    text: "#1C1B2E",
    textMuted: "#5E5C78",
    textSubtle: "#A9A7BD",
    brand: "#5B5BD6",
    brandEdge: "#3B35A0",
    brandSoft: "#EEF0FF",
    brandText: "#4B46C4",
    onBrand: "#FFFFFF",
    accent: "#FF7A59",
    accentEdge: "#D9532F",
    onAccent: "#2A1308",
    success: "#10B981",
    successText: "#047857",
    successSoft: "#E3F8EF",
    danger: "#F43F5E",
    dangerText: "#BE123C",
    dangerSoft: "#FFE8EC",
    gold: "#F6C343",
    goldText: "#8A6100",
    goldSoft: "#FFF4D6",
    scrim: "rgba(28, 27, 46, 0.48)",
    focus: "#5B5BD6",
    heroFrom: "#EEF0FF",
    heroTo: "#DCDDFF",
    boardLight: "#EEEDFF",
    boardDark: "#8E8BE3",
    boardSelect: "rgba(255, 200, 87, 0.75)",
    boardMove: "rgba(255, 241, 200, 0.62)",
    boardHint: "rgba(47, 190, 132, 0.55)",
    boardCheck: "rgba(240, 82, 82, 0.72)",
    boardDot: "rgba(30, 27, 75, 0.32)",
    boardCoordOnLight: "#5D5AB8",
    boardCoordOnDark: "#F4F3FF",
  },
  dark: {
    bg: "#14152B",
    card: "#1D1F3A",
    sunken: "#262947",
    line: "#343760",
    text: "#EDEDF6",
    textMuted: "#B4B3CF",
    textSubtle: "#7B7A9C",
    brand: "#6363E0",
    brandEdge: "#34308F",
    brandSoft: "#2A2F57",
    brandText: "#B3B8FF",
    onBrand: "#FFFFFF",
    accent: "#FF8A6B",
    accentEdge: "#C4512F",
    onAccent: "#2A1308",
    success: "#34D399",
    successText: "#5EE3B0",
    successSoft: "#143A35",
    danger: "#FB7185",
    dangerText: "#FF9AAA",
    dangerSoft: "#3D1B2C",
    gold: "#F6C343",
    goldText: "#F8D375",
    goldSoft: "#3A3220",
    scrim: "rgba(5, 6, 18, 0.66)",
    focus: "#B3B8FF",
    heroFrom: "#2A2F57",
    heroTo: "#1F2246",
    boardLight: "#C9C7F0",
    boardDark: "#6461C4",
    boardSelect: "rgba(255, 200, 87, 0.78)",
    boardMove: "rgba(255, 241, 200, 0.42)",
    boardHint: "rgba(47, 190, 132, 0.6)",
    boardCheck: "rgba(240, 82, 82, 0.78)",
    boardDot: "rgba(20, 21, 43, 0.4)",
    boardCoordOnLight: "#3F3C9E",
    boardCoordOnDark: "#F4F3FF",
  },
};

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Minimum touch target on every platform. */
export const minTarget = 56;

export const fontFamily = "Fredoka";
export const fontWeights = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const;
export type FontWeight = keyof typeof fontWeights;

/** Type scale in px (web uses rem = px / 16; native scales with Dynamic Type). */
export const type = {
  hero: { size: 32, line: 38, weight: "bold" },
  title: { size: 26, line: 32, weight: "bold" },
  heading: { size: 20, line: 26, weight: "semibold" },
  bodyLg: { size: 18, line: 26, weight: "medium" },
  body: { size: 16, line: 24, weight: "regular" },
  label: { size: 16, line: 20, weight: "semibold" },
  small: { size: 14, line: 20, weight: "regular" },
  micro: { size: 12, line: 16, weight: "medium" },
} as const satisfies Record<string, { size: number; line: number; weight: FontWeight }>;
export type TypeRole = keyof typeof type;

export const shadow = {
  card: { color: "#1C1B2E", opacity: 0.1, radius: 16, y: 6 },
  pop: { color: "#5B5BD6", opacity: 0.35, radius: 28, y: 14 },
  /** Tactile button edge height in px */
  edge: 4,
} as const;

export const motion = {
  duration: { tap: 140, base: 240, slow: 420, ceremony: 1100, splash: 1500 },
  easing: {
    out: [0.16, 1, 0.3, 1],
    spring: [0.34, 1.56, 0.64, 1],
    inOut: [0.45, 0, 0.55, 1],
  },
  spring: { gentle: { damping: 18, stiffness: 180 }, lively: { damping: 12, stiffness: 260 } },
} as const;

/* ---------- app themes ---------- */

export type ThemeId = "classroom" | "garden" | "sunset" | "ocean" | "midnight" | "library" | "contrast";
export type ThemeInfo = { id: ThemeId; name: string; blurb: string; scheme: Scheme | "auto" };

/** Classroom follows the Appearance setting (light/dark); every other theme is one committed look. */
export const THEMES: readonly ThemeInfo[] = [
  { id: "classroom", name: "Classroom", blurb: "Indigo, light or dark", scheme: "auto" },
  { id: "garden", name: "Garden", blurb: "Sage and cream", scheme: "light" },
  { id: "sunset", name: "Sunset", blurb: "Warm peach and coral", scheme: "light" },
  { id: "ocean", name: "Ocean", blurb: "Deep teal", scheme: "dark" },
  { id: "midnight", name: "Midnight", blurb: "True black and gold", scheme: "dark" },
  { id: "library", name: "Library", blurb: "Wood and paper", scheme: "light" },
  { id: "contrast", name: "High contrast", blurb: "Black and white, easiest to read", scheme: "light" },
];
export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

const board = (light: string, dark: string, coordOnLight: string, coordOnDark: string, dot = "rgba(30, 27, 75, 0.32)") => ({
  boardLight: light,
  boardDark: dark,
  boardSelect: "rgba(255, 200, 87, 0.75)",
  boardMove: "rgba(255, 241, 200, 0.6)",
  boardHint: "rgba(47, 190, 132, 0.6)",
  boardCheck: "rgba(240, 82, 82, 0.75)",
  boardDot: dot,
  boardCoordOnLight: coordOnLight,
  boardCoordOnDark: coordOnDark,
});

export const themePalettes: Record<Exclude<ThemeId, "classroom">, Palette> = {
  garden: {
    bg: "#F6F8F1", card: "#FFFFFF", sunken: "#ECF1E4", line: "#DDE5D2",
    text: "#1B2618", textMuted: "#4F5E49", textSubtle: "#9AA892",
    brand: "#3F7D4E", brandEdge: "#2A5A37", brandSoft: "#E4F1E3", brandText: "#2F6B3F", onBrand: "#FFFFFF",
    accent: "#F08A5D", accentEdge: "#C9633A", onAccent: "#2A1308",
    success: "#22A06B", successText: "#146C46", successSoft: "#E1F5EA",
    danger: "#E5484D", dangerText: "#B42318", dangerSoft: "#FDECEC",
    gold: "#E7B53C", goldText: "#7A5600", goldSoft: "#FBF1D3",
    scrim: "rgba(20, 30, 18, 0.48)", focus: "#3F7D4E", heroFrom: "#E9F3E2", heroTo: "#D6E9CF",
    ...board("#F1F3E3", "#7FA36B", "#4F7A3E", "#F4F7EE", "rgba(25, 40, 20, 0.32)"),
  },
  sunset: {
    bg: "#FFF8F3", card: "#FFFFFF", sunken: "#FCEDE3", line: "#F4DED0",
    text: "#2A1A14", textMuted: "#6B4E42", textSubtle: "#B79A8E",
    brand: "#C4473A", brandEdge: "#93301F", brandSoft: "#FDEAE2", brandText: "#A8392C", onBrand: "#FFFFFF",
    accent: "#F2A541", accentEdge: "#C47A12", onAccent: "#2A1308",
    success: "#2E9E6B", successText: "#17704A", successSoft: "#E3F5EC",
    danger: "#E04F5F", dangerText: "#B4233C", dangerSoft: "#FDE9EC",
    gold: "#EDB443", goldText: "#7E5600", goldSoft: "#FDF1D6",
    scrim: "rgba(42, 26, 20, 0.48)", focus: "#C4473A", heroFrom: "#FFEDE2", heroTo: "#FFD9C6",
    ...board("#FCEBDD", "#D98A6A", "#B5654A", "#FFF6EE", "rgba(60, 25, 15, 0.3)"),
  },
  ocean: {
    bg: "#0A2128", card: "#0D2830", sunken: "#133540", line: "#1F4A57",
    text: "#E6F4F6", textMuted: "#9EC4CC", textSubtle: "#5F8E98",
    brand: "#117A8C", brandEdge: "#0A4E5A", brandSoft: "#123E4A", brandText: "#7FD6E3", onBrand: "#FFFFFF",
    accent: "#FF9F7A", accentEdge: "#C96A45", onAccent: "#2A1308",
    success: "#34D399", successText: "#5EE3B0", successSoft: "#0F3A33",
    danger: "#FB7185", dangerText: "#FF9AAA", dangerSoft: "#3A1B28",
    gold: "#F6C343", goldText: "#F8D375", goldSoft: "#33301C",
    scrim: "rgba(3, 14, 18, 0.7)", focus: "#7FD6E3", heroFrom: "#123A45", heroTo: "#0F2F38",
    ...board("#BFE6EA", "#3C8D9A", "#2C6F7A", "#EAF8FA", "rgba(5, 30, 36, 0.4)"),
  },
  midnight: {
    bg: "#000000", card: "#0E0E10", sunken: "#18181C", line: "#2A2A30",
    text: "#F4F1E8", textMuted: "#B9B2A0", textSubtle: "#77715F",
    brand: "#E3B341", brandEdge: "#9C7A1E", brandSoft: "#2A2412", brandText: "#F0CC6E", onBrand: "#1A1408",
    accent: "#E8A06A", accentEdge: "#A86A3A", onAccent: "#1A0E05",
    success: "#4ADE80", successText: "#6EE7A0", successSoft: "#0E2A1B",
    danger: "#F87171", dangerText: "#FCA5A5", dangerSoft: "#2E1214",
    gold: "#E3B341", goldText: "#F0CC6E", goldSoft: "#2A2412",
    scrim: "rgba(0, 0, 0, 0.72)", focus: "#F0CC6E", heroFrom: "#16130B", heroTo: "#0E0C07",
    ...board("#D7BE7E", "#8A6F37", "#6E5A2E", "#FBF1D6", "rgba(20, 16, 8, 0.42)"),
  },
  library: {
    bg: "#F7F1E6", card: "#FFFCF6", sunken: "#EFE5D3", line: "#E2D5BD",
    text: "#2B2117", textMuted: "#64513C", textSubtle: "#A8957A",
    brand: "#7A4A23", brandEdge: "#4F2E12", brandSoft: "#F2E4D0", brandText: "#6E4220", onBrand: "#FFFFFF",
    accent: "#D9824B", accentEdge: "#A85A27", onAccent: "#2A1308",
    success: "#2F8F5B", successText: "#1D6B42", successSoft: "#E3F2E8",
    danger: "#D64545", dangerText: "#A82727", dangerSoft: "#FBE8E5",
    gold: "#D9A53A", goldText: "#7A5400", goldSoft: "#FAEFD4",
    scrim: "rgba(43, 33, 23, 0.5)", focus: "#7A4A23", heroFrom: "#F4E8D6", heroTo: "#EAD8BD",
    ...board("#F0D9B5", "#B58863", "#946F4B", "#FFF4E4", "rgba(40, 25, 10, 0.3)"),
  },
  contrast: {
    bg: "#FFFFFF", card: "#FFFFFF", sunken: "#F0F0F0", line: "#1A1A1A",
    text: "#000000", textMuted: "#2B2B2B", textSubtle: "#595959",
    brand: "#000000", brandEdge: "#000000", brandSoft: "#EDEDED", brandText: "#000000", onBrand: "#FFFFFF",
    accent: "#FFD400", accentEdge: "#B39400", onAccent: "#000000",
    success: "#007A3D", successText: "#005C2E", successSoft: "#E5F5EC",
    danger: "#C40000", dangerText: "#A30000", dangerSoft: "#FDE7E7",
    gold: "#FFC400", goldText: "#5C4300", goldSoft: "#FFF3C4",
    scrim: "rgba(0, 0, 0, 0.6)", focus: "#0047FF", heroFrom: "#F0F0F0", heroTo: "#E6E6E6",
    ...board("#FFFFFF", "#8C8C8C", "#000000", "#FFFFFF", "rgba(0, 0, 0, 0.55)"),
    boardMove: "rgba(0, 71, 255, 0.22)",
    boardSelect: "rgba(255, 212, 0, 0.8)",
  },
};

/** The palette and light/dark scheme for a theme (Classroom resolves through Appearance). */
export function resolveTheme(theme: ThemeId, appearance: Appearance, systemDark: boolean): { scheme: Scheme; palette: Palette } {
  if (theme === "classroom" || !(theme in themePalettes)) {
    const scheme = resolveScheme(appearance, systemDark);
    return { scheme, palette: palettes[scheme] };
  }
  const info = THEMES.find((t) => t.id === theme)!;
  return { scheme: info.scheme as Scheme, palette: themePalettes[theme as Exclude<ThemeId, "classroom">] };
}

export const breakpoints = { tablet: 768, desktop: 1200, contentMax: 1120 } as const;

export function resolveScheme(appearance: Appearance, systemDark: boolean): Scheme {
  if (appearance === "system") return systemDark ? "dark" : "light";
  return appearance;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** CSS custom properties for a scheme or palette, e.g. `--cs-bg:#FBFAFF;`. */
export function cssVars(scheme: Scheme | Palette): string {
  return Object.entries(typeof scheme === "string" ? palettes[scheme] : scheme)
    .map(([k, v]) => `--cs-${kebab(k)}:${v};`)
    .join("");
}
