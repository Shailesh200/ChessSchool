import { describe, expect, it } from "vitest";
import { copy } from "./copy";
import { createApiClient, errorMessage } from "./api";

const EMAIL_IN_USE = "This email already has an account. Sign in with email instead.";

function client(path: string) {
  return createApiClient({
    baseUrl: "https://api.test",
    fetchImpl: async (input) => {
      expect(String(input)).toBe(`https://api.test${path}`);
      return new Response(JSON.stringify({ error: "email_in_use" }), { status: 409, headers: { "Content-Type": "application/json" } });
    },
  });
}

describe("email_in_use", () => {
  it("maps a 409 from Apple and Google sign-in to the auth copy", async () => {
    expect(copy.auth.emailInUse).toBe(EMAIL_IN_USE);
    for (const run of [() => client("/v1/auth/apple").apple({ identityToken: "token" }), () => client("/v1/auth/google").google({ idToken: "token" })]) {
      const err = await run().catch((e: unknown) => e);
      expect(err).toMatchObject({ status: 409, code: "email_in_use" });
      expect(errorMessage(err)).toBe(EMAIL_IN_USE);
      expect(errorMessage(err)).not.toBe(copy.auth.errors.generic);
      expect(errorMessage(err)).not.toBe(copy.auth.errors.offline);
    }
  });
});
