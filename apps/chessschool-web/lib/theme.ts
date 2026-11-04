import type { Appearance, ThemeId } from "@chessschool/design";

export const APPEARANCE_KEY = "chessschool.v2.appearance";
export const THEME_KEY = "chessschool.v2.theme";

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){try{var d=document.documentElement;var a=localStorage.getItem("${APPEARANCE_KEY}");if(a==="light"||a==="dark"){d.dataset.theme=a}var t=localStorage.getItem("${THEME_KEY}");if(t&&t!=="classroom"){d.dataset.csTheme=t}}catch(e){}})();`;

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
