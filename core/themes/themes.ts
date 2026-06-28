"use client";

/**
 * Theme Academy — board + school themes applied instantly via CSS variables and
 * data attributes on <html>. Board colors are consumed by the chessboard; school
 * themes retint surfaces/accents (see globals.css `html[data-school-theme=...]`).
 */

export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  /** highlight + last-move tints */
  move: string;
}

export const BOARD_THEMES: Record<string, BoardTheme> = {
  classic: { id: "classic", name: "Classic", light: "#eef0f4", dark: "#7c8aa5", move: "#7be0b3" },
  chalkboard: { id: "chalkboard", name: "Chalkboard", light: "#5b6b63", dark: "#2f3b38", move: "#9fe3c5" },
  marble: { id: "marble", name: "Marble", light: "#f3efe9", dark: "#b9b2a7", move: "#9ad0c2" },
  tournament: { id: "tournament", name: "Tournament", light: "#e9eef0", dark: "#6a9b78", move: "#f2c14e" },
  wooden: { id: "wooden", name: "Wooden", light: "#e8cfa6", dark: "#a9743f", move: "#7fd1a8" },
  neon: { id: "neon", name: "Neon", light: "#1f2238", dark: "#3a2f6b", move: "#41e0c8" },
  paper: { id: "paper", name: "Paper", light: "#faf7f0", dark: "#cdbf9c", move: "#8fd0b0" },
  midnight: { id: "midnight", name: "Midnight", light: "#3a3f5c", dark: "#1c2036", move: "#5aa9e6" },
  // legacy names kept so migrated settings still resolve
  violet: { id: "violet", name: "Violet", light: "#ede7f6", dark: "#b9a8e6", move: "#7be0b3" },
  slate: { id: "slate", name: "Slate", light: "#e8eef7", dark: "#9bb8d3", move: "#5aa9e6" },
  forest: { id: "forest", name: "Forest", light: "#e9efe1", dark: "#a3c293", move: "#7fd1a8" },
};

export const SELECTABLE_BOARD_THEMES = [
  "classic", "chalkboard", "marble", "tournament", "wooden", "neon", "paper", "midnight",
] as const;

export interface AppTheme {
  id: string;
  name: string;
  emoji: string;
  /** small swatch [surface, card, brandHint] for the picker */
  swatch: [string, string, string];
  dark?: boolean;
}

/** Global surface palettes (#106). Surfaces/ink only — brand stays the school theme. */
export const APP_THEMES: AppTheme[] = [
  { id: "default", name: "Classic", emoji: "🎓", swatch: ["#fbfaff", "#ffffff", "#5b5bd6"] },
  { id: "blue", name: "School Blue", emoji: "💙", swatch: ["#eef4fb", "#ffffff", "#2563eb"] },
  { id: "forest", name: "Forest", emoji: "🌲", swatch: ["#eef5ee", "#ffffff", "#0f7a55"] },
  { id: "ivory", name: "Ivory", emoji: "🤍", swatch: ["#faf8f2", "#fffdf8", "#9a8f70"] },
  { id: "royal", name: "Royal", emoji: "👑", swatch: ["#f4eefb", "#ffffff", "#6d28d9"] },
  { id: "midnight", name: "Midnight", emoji: "🌙", swatch: ["#14152b", "#1d1f3a", "#7b6ff0"], dark: true },
];

export function getAppTheme(id: string): AppTheme {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0]!;
}

export interface SchoolTheme {
  id: string;
  name: string;
  emoji: string;
}

export const SCHOOL_THEMES: SchoolTheme[] = [
  { id: "elementary", name: "Elementary", emoji: "🎒" },
  { id: "highschool", name: "High School", emoji: "📐" },
  { id: "university", name: "University", emoji: "🏛️" },
  { id: "graduation", name: "Graduation", emoji: "🎓" },
];

export function getBoardTheme(id: string): BoardTheme {
  return BOARD_THEMES[id] ?? BOARD_THEMES.classic!;
}

export function applyTheme(
  boardThemeId: string,
  schoolThemeId: string,
  appThemeId = "default",
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const board = getBoardTheme(boardThemeId);
  root.dataset.boardTheme = board.id;
  root.dataset.schoolTheme = schoolThemeId;
  root.dataset.appTheme = appThemeId;
  root.style.colorScheme = getAppTheme(appThemeId).dark ? "dark" : "light";
  root.style.setProperty("--board-light", board.light);
  root.style.setProperty("--board-dark", board.dark);
  root.style.setProperty("--board-move", board.move);
}
