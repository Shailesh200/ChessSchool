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
};
export type FeatureId = keyof typeof FEATURES;
