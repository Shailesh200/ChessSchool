/**
 * Features the server can switch off without a store build. Read by GET /v1/features;
 * each route below checks its own flag and answers 404 while it is off.
 */
export const FEATURES = {
  /** Share cards (POST /v1/shares, GET /v1/share/card/:kind). */
  shareCards: true,
  /** Challenge a friend links (/c/<code>). */
  challenges: true,
  /** Invite links (/i/<code>) and their streak-freeze rewards. */
  invites: true,
  leagues: true,
  mateOfTheDay: true,
  /** Every AI feature: coach explanations and lines, hint reasons, AI bot moves, the board scanner. */
  ai: true,
};

/**
 * Whether one account may use the AI features. For now the global switch decides for everyone;
 * shortcut: no per-account override yet, add a users column (or table) here when some accounts need it on or off.
 */
export const aiEnabledFor = (_user: { id: string }) => FEATURES.ai;
export type FeatureId = keyof typeof FEATURES;
