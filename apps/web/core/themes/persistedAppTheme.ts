/** Read the same settings shape the theme bootstrap script uses. */
export function readPersistedAppTheme(): { appTheme: string; uiKit: string } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("chessschool.settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { appTheme?: unknown; uiKit?: unknown } };
    const state = parsed?.state ?? (parsed as { appTheme?: unknown; uiKit?: unknown });
    const appTheme = typeof state?.appTheme === "string" ? state.appTheme : "default";
    const uiKit = typeof state?.uiKit === "string" ? state.uiKit : "premium";
    return { appTheme, uiKit };
  } catch {
    return null;
  }
}
