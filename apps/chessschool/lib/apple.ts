import type { AppleSignInBody } from "@chessschool/design";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

const CANCELLED = "ERR_REQUEST_CANCELED";

type AppleModule = typeof import("expo-apple-authentication");

function load(): AppleModule | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("expo-apple-authentication") as AppleModule;
  } catch {
    return null;
  }
}

export function appleModule(): AppleModule | null {
  return load();
}

export async function appleAvailable(): Promise<boolean> {
  const mod = load();
  if (!mod) return false;
  try {
    return await mod.isAvailableAsync();
  } catch {
    return false;
  }
}

export function isAppleCancel(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === CANCELLED;
}

/** 32 random bytes as hex. This string is the raw nonce sent to the API. */
function rawNonce(): string {
  const bytes = Crypto.getRandomBytes(32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Starts Sign in with Apple.
 * Returns null when the learner cancels. Throws on any other failure.
 * `nonce` in the result is the raw nonce; Apple is given sha256(raw) as hex.
 */
export async function appleCredential(): Promise<AppleSignInBody | null> {
  const mod = load();
  if (!mod) throw new Error("apple-unavailable");
  const nonce = rawNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  let credential: Awaited<ReturnType<AppleModule["signInAsync"]>>;
  try {
    credential = await mod.signInAsync({
      requestedScopes: [mod.AppleAuthenticationScope.FULL_NAME, mod.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isAppleCancel(err)) return null;
    throw err;
  }
  const identityToken = credential.identityToken;
  if (!identityToken) throw new Error("apple-failed");
  const givenName = credential.fullName?.givenName?.trim() || undefined;
  const familyName = credential.fullName?.familyName?.trim() || undefined;
  const email = credential.email?.trim() || undefined;
  const fullName = givenName || familyName ? { ...(givenName ? { givenName } : {}), ...(familyName ? { familyName } : {}) } : undefined;
  return { identityToken, nonce, ...(fullName ? { fullName } : {}), ...(email ? { email } : {}) };
}
