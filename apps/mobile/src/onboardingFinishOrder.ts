/** Apply onboarding choices locally only after the server enrollment call succeeds (DP-M-010). */
export function onboardingSettingsPatch(
  goal: string,
  elo: string,
  time: string,
  coachCharacter: string,
  theme: string,
  avatar: string,
): Record<string, unknown> {
  return {
    goal,
    targetElo: Number(elo) || 600,
    planTier: time || "standard",
    coachCharacter,
    appTheme: theme || "default",
    avatar,
  };
}
