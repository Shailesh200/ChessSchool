import { nativeIconName } from "@chessschool/design";
import Constants, { ExecutionEnvironment } from "expo-constants";

type Icons = typeof import("expo-alternate-app-icons");

/** The native module only exists in development and store builds (not Expo Go). */
function module(): Icons | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    return require("expo-alternate-app-icons") as Icons;
  } catch {
    return null;
  }
}

export const appIconsSupported = () => Boolean(module()?.supportsAlternateIcons);

/** Switches the home-screen icon; "classroom" is the default store icon. Returns false if unavailable. */
export async function setAppIcon(id: string): Promise<boolean> {
  const m = module();
  if (!m?.supportsAlternateIcons) return false;
  try {
    await m.setAlternateAppIcon(id === "classroom" ? null : nativeIconName(id));
    return true;
  } catch {
    return false;
  }
}
