import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "chessschool.orientationSeen";
const isWeb = Platform.OS === "web";

export async function getOrientationSeen(): Promise<boolean> {
  try {
    if (isWeb) {
      if (typeof localStorage === "undefined") return false;
      return localStorage.getItem(KEY) === "1";
    }
    const raw = await SecureStore.getItemAsync(KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function setOrientationSeen(): Promise<void> {
  try {
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, "1");
      return;
    }
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Dev / settings — replay the first-run walkthrough. */
export async function clearOrientationSeen(): Promise<void> {
  try {
    if (isWeb) {
      if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* ignore */
  }
}
