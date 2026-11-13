import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";
import { audienceAllowed, createGoogleVerifier, parseGoogleClientIds, type GoogleTokenClaims } from "../src/google";

const WEB = "web-client.example";
const NATIVE = "native-client.example";

describe("parseGoogleClientIds", () => {
  it("trims entries and drops empties", () => {
    expect(parseGoogleClientIds(undefined)).toEqual([]);
    expect(parseGoogleClientIds(null)).toEqual([]);
    expect(parseGoogleClientIds("")).toEqual([]);
    expect(parseGoogleClientIds("   ")).toEqual([]);
    expect(parseGoogleClientIds(",,,")).toEqual([]);
    expect(parseGoogleClientIds(" , , ")).toEqual([]);
    expect(parseGoogleClientIds(` ${WEB} , , ${NATIVE} `)).toEqual([WEB, NATIVE]);
  });
});

describe("audienceAllowed", () => {
  it("accepts only an exact allow-list match", () => {
    expect(audienceAllowed(WEB, [WEB, NATIVE])).toBe(true);
    expect(audienceAllowed([NATIVE], [WEB, NATIVE])).toBe(true);
    expect(audienceAllowed("other.example", [WEB])).toBe(false);
    expect(audienceAllowed([WEB, "other.example"], [WEB, NATIVE])).toBe(false);
    expect(audienceAllowed(undefined, [WEB])).toBe(false);
    expect(audienceAllowed("", [WEB])).toBe(false);
    expect(audienceAllowed(WEB, [])).toBe(false);
    expect(audienceAllowed(WEB, [" ", ""])).toBe(false);
  });
});

describe("createGoogleVerifier", () => {
  const claims = (aud: GoogleTokenClaims["aud"]): GoogleTokenClaims => ({
    sub: "sub-1",
    email: "Ada@Example.com",
    email_verified: true,
    name: "Ada",
    aud,
  });

  it("returns no verifier for a missing or empty allow-list and does not verify", async () => {
    let called = false;
    const verify = async () => {
      called = true;
      return claims(WEB);
    };
    expect(createGoogleVerifier([], verify)).toBeNull();
    expect(createGoogleVerifier([" ", ""], verify)).toBeNull();
    expect(createGoogleVerifier(parseGoogleClientIds(" , , "), verify)).toBeNull();
    expect(called).toBe(false);
  });

  it("accepts a token whose audience is the web client id", async () => {
    const seen: string[][] = [];
    const verify = async (_token: string, audience: readonly string[]) => {
      seen.push([...audience]);
      return claims(WEB);
    };
    const verifier = createGoogleVerifier(parseGoogleClientIds(` ${WEB} , ${NATIVE} `), verify);
    expect(verifier).not.toBeNull();
    await expect(verifier!("good-token")).resolves.toMatchObject({ sub: "sub-1", email: "ada@example.com", emailVerified: true, name: "Ada" });
    expect(seen).toEqual([[WEB, NATIVE]]);
  });

  it("rejects a token with the wrong audience", async () => {
    const verifier = createGoogleVerifier([WEB], async () => claims("other.example"));
    await expect(verifier!("forged")).resolves.toBeNull();
  });

  it("rejects a token with no audience or an audience outside the list", async () => {
    const missing = createGoogleVerifier([WEB], async () => claims(undefined));
    const extra = createGoogleVerifier([WEB, NATIVE], async () => claims([WEB, "other.example"]));
    await expect(missing!("t")).resolves.toBeNull();
    await expect(extra!("t")).resolves.toBeNull();
  });

  it("signs in through the route only when the audience matches", async () => {
    const db = await openDb(":memory:");
    const google = createGoogleVerifier([WEB], async (token) => (token === "good" ? claims(WEB) : claims("other.example")));
    const app = createApp({ db, google, secureCookies: false, corsOrigins: [], now: () => new Date("2026-11-03T10:00:00Z") });
    const post = (idToken: string) =>
      app.request("/v1/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "7.7.7.7" },
        body: JSON.stringify({ idToken }),
      });
    const ok = await post("good");
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { user: { email: string } }).user.email).toBe("ada@example.com");
    const bad = await post("bad");
    expect(bad.status).toBe(401);
    expect(((await bad.json()) as { error: string }).error).toBe("google_invalid");
  });
});
