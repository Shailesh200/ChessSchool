import { createApiClient, errorMessage, pulseForApi } from "@chessschool/design";
import { track } from "./analytics";

/** Same-origin: next.config rewrites /v1/* to the API so the session cookie is first-party. */
export const api = createApiClient({
  baseUrl: "",
  onSuccess: (method, path, body, data) => {
    const ev = pulseForApi(method, path, body, data);
    if (ev) track(ev[0], ev[1]);
  },
});

export { errorMessage };
