/**
 * Server-side switches for features a store build already ships, read by GET /v1/features.
 * Turning one off here hides it in the apps without a new build.
 */
export const FEATURES = {
  leagues: true,
  mateOfTheDay: true,
};
export type FeatureId = keyof typeof FEATURES;
