/** Seven-day snooze after "Maybe later" on the enroll prompt. */
export const ENROLL_PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export function lessonsAttemptedCount(
  lessons: Record<string, { attempts?: number } | undefined>,
): number {
  return Object.values(lessons).filter((l) => (l?.attempts ?? 0) > 0).length;
}

export function shouldShowEnrollPrompt(opts: {
  authed: boolean | null;
  dismissedAt: number | null | undefined;
  lessonsAttempted: number;
  now?: number;
}): boolean {
  if (opts.authed !== false) return false;
  if (opts.lessonsAttempted < 1) return false;
  const dismissed = opts.dismissedAt ?? 0;
  if (dismissed > 0) {
    const now = opts.now ?? Date.now();
    if (now - dismissed < ENROLL_PROMPT_DISMISS_MS) return false;
  }
  return true;
}

/** Auto-open the sheet the first time a guest finishes any lesson. */
export function shouldAutoOpenEnrollPrompt(opts: {
  authed: boolean | null;
  dismissedAt: number | null | undefined;
  lessonsAttempted: number;
  now?: number;
}): boolean {
  return opts.lessonsAttempted === 1 && shouldShowEnrollPrompt(opts);
}
