const QA_SIM_API_URLS = ["http://localhost:3108", "http://10.0.2.2:3108"] as const;

/** Fail a qa-sim build unless the public API URL is one of the simulator hosts. */
export function assertQaSimApiUrl(raw: string | undefined): void {
  if (raw === QA_SIM_API_URLS[0] || raw === QA_SIM_API_URLS[1]) return;
  throw new Error(
    "qa-sim build requires EXPO_PUBLIC_API_URL to be http://localhost:3108 or http://10.0.2.2:3108.",
  );
}

/** The host-elimination flag must travel with the qa-sim URL. */
export function assertQaSimFlag(raw: string | undefined): void {
  if (raw === "1") return;
  throw new Error("qa-sim build requires EXPO_PUBLIC_QA_SIM to be 1.");
}
