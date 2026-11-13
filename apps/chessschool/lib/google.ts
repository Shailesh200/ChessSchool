import Constants, { ExecutionEnvironment } from "expo-constants";
import { TurboModuleRegistry } from "react-native";

// Google Sign-In needs a native build (not Expo Go). Load it lazily so Expo Go still runs.
type GoogleModule = typeof import("@react-native-google-signin/google-signin");

let mod: GoogleModule | null | undefined;

/** Missing, blank, or explicitly disabled. Never reaches GoogleSignin in that case. */
function googleOff(): boolean {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  return process.env.EXPO_PUBLIC_CS_DISABLE_GOOGLE === "1" || clientId.length === 0;
}

function load(): GoogleModule | null {
  if (mod !== undefined) return mod;
  // Requiring the JS package without its native half throws during module init, which
  // dev builds surface as a fatal error even inside try/catch. Check first.
  if (googleOff() || Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !TurboModuleRegistry.get("RNGoogleSignin")) {
    mod = null;
    return mod;
  }
  try {
    mod = require("@react-native-google-signin/google-signin") as GoogleModule;
    mod.GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });
  } catch {
    mod = null;
  }
  return mod;
}

export const googleAvailable = () => !googleOff() && load() !== null;

/** Returns an ID token, null if the learner cancelled. Throws on configuration errors. */
export async function googleIdToken(): Promise<string | null> {
  const m = load();
  if (!m) throw new Error("google-unavailable");
  await m.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await m.GoogleSignin.signIn();
  if (res.type !== "success") return null;
  return res.data.idToken ?? null;
}

export async function googleSignOut() {
  try {
    await load()?.GoogleSignin.signOut();
  } catch {}
}
