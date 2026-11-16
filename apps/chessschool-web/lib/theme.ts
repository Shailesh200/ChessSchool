import type { Appearance, BoardColorsId, ThemeId } from "@chessschool/design";

export const APPEARANCE_KEY = "chessschool.v2.appearance";
export const THEME_KEY = "chessschool.v2.theme";

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. A fresh visitor gets Sunset. */
export const themeBootScript = `(function(){try{var d=document.documentElement;var a=localStorage.getItem("${APPEARANCE_KEY}");if(a==="light"||a==="dark"){d.dataset.theme=a}var t=localStorage.getItem("${THEME_KEY}")||"sunset";if(t==="classroom"){delete d.dataset.csTheme}else{d.dataset.csTheme=t}}catch(e){}})();`;

export function applyAppearance(appearance: Appearance) {
  const el = document.documentElement;
  if (appearance === "system") delete el.dataset.theme;
  else el.dataset.theme = appearance;
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {}
}

/** Non-Classroom themes override the light/dark variables via [data-cs-theme]. */
export function applyTheme(theme: ThemeId) {
  const el = document.documentElement;
  if (theme === "classroom") delete el.dataset.csTheme;
  else el.dataset.csTheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

/** Accessibility prefs as <html> attributes: board colours, easy-reading font and reduced motion (see globals.css). */
export function applyAccess(board: BoardColorsId, easyFont: boolean, reduceMotion: boolean) {
  const d = document.documentElement.dataset;
  if (board === "theme") delete d.csBoard;
  else d.csBoard = board;
  if (easyFont) d.csFont = "easy";
  else delete d.csFont;
  if (reduceMotion) d.csMotion = "reduce";
  else delete d.csMotion;
}

/** Swaps the browser tab icon to the chosen app icon (installed PWA icons can't change). */
export function applyFavicon(icon: string) {
  const href = icon === "classroom" ? "/assets/raster/favicon-48.png" : `/assets/raster/app-icons/${icon}-preview.png`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-cs]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.dataset.cs = "";
    document.head.appendChild(link);
  }
  link.href = href;
}
