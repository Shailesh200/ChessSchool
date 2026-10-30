/** True when a tutorial finish failed to save and should offer Retry (DP-M-009). */
export function shouldShowTutorialSaveRetry(
  phase: string,
  saveError: string | null,
): boolean {
  return phase === "save-retry" && saveError !== null && saveError.length > 0;
}
