/** Production web/API origin. The host literal is omitted from qa-sim bundles. */
export const PRODUCTION_URL =
  process.env.EXPO_PUBLIC_QA_SIM === "1" ? "" : "https://www.chess-school.in";

export const PRIVACY_URL =
  process.env.EXPO_PUBLIC_QA_SIM === "1"
    ? `${process.env.EXPO_PUBLIC_API_URL ?? ""}/privacy`
    : `${PRODUCTION_URL}/privacy`;

/**
 * Public in-app support contact. Mailto links and contact copy must read this.
 * The address is on the production host, so like PRODUCTION_URL it is omitted
 * (empty string) from qa-sim bundles; callers must render nothing when it is "".
 */
export const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_QA_SIM === "1" ? "" : "support@chess-school.in";
