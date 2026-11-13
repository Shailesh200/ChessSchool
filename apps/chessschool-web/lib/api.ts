import { createApiClient, errorMessage } from "@chessschool/design";

/** Same-origin: next.config rewrites /v1/* to the API so the session cookie is first-party. */
export const api = createApiClient({ baseUrl: "" });

export { errorMessage };
