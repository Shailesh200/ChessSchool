/** Production web/API origin. The host literal is omitted from qa-sim bundles. */
export const PRODUCTION_URL =
  process.env.EXPO_PUBLIC_QA_SIM === "1" ? "" : "https://www.chess-school.in";

export const PRIVACY_URL =
  process.env.EXPO_PUBLIC_QA_SIM === "1"
    ? `${process.env.EXPO_PUBLIC_API_URL ?? ""}/privacy`
    : `${PRODUCTION_URL}/privacy`;
