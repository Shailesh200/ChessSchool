/** School brand palettes — matched to apps/web/app/globals.css school theme tokens. */

export interface SchoolThemeDef {
  id: string;
  name: string;
  emoji: string;
  chrome: string;
  brand: string;
  brand600: string;
  brand700: string;
  brand50: string;
  brand100: string;
  brand300: string;
  accent: string;
  accent600: string;
}

export const SCHOOL_THEMES: SchoolThemeDef[] = [
  {
    id: "elementary",
    name: "Elementary",
    emoji: "🎒",
    chrome: "Playful corners · soft campus glow",
    brand: "#2563eb",
    brand600: "#1d4ed8",
    brand700: "#1e40af",
    brand50: "#dbeafe",
    brand100: "#bfdbfe",
    brand300: "#93c5fd",
    accent: "#ff7a59",
    accent600: "#f2613f",
  },
  {
    id: "highschool",
    name: "High School",
    emoji: "📐",
    chrome: "Sharp cards · ruled header",
    brand: "#0f766e",
    brand600: "#0d655e",
    brand700: "#0a504a",
    brand50: "#ccfbf1",
    brand100: "#99f6e4",
    brand300: "#5eead4",
    accent: "#ff7a59",
    accent600: "#cf4324",
  },
  {
    id: "university",
    name: "University",
    emoji: "🏛️",
    chrome: "Classic campus · subtle crest",
    brand: "#5b5bd6",
    brand600: "#4b46c4",
    brand700: "#3b35a0",
    brand50: "#ededfd",
    brand100: "#d8d7fa",
    brand300: "#aab2ff",
    accent: "#ff7a59",
    accent600: "#f2613f",
  },
  {
    id: "graduation",
    name: "Graduation",
    emoji: "🎓",
    chrome: "Ceremonial radius · gold accents",
    brand: "#6d28d9",
    brand600: "#5b21b6",
    brand700: "#4c1d95",
    brand50: "#f3e8ff",
    brand100: "#e9d5ff",
    brand300: "#c4b5fd",
    accent: "#f59e0b",
    accent600: "#d97706",
  },
];

export function getSchoolTheme(id: string): SchoolThemeDef {
  return SCHOOL_THEMES.find((t) => t.id === id) ?? SCHOOL_THEMES.find((t) => t.id === "university")!;
}
