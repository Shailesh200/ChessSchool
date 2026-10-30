import { useFonts } from "expo-font";
import { useEffect } from "react";
import { setKitFontsReady } from "./mapTokens";

/** Static TTF kit faces (one Expo family name per weight). No woff2 on native. */
export const KIT_FONT_ASSETS = {
  KitBricolageExtraBold: require("../../../assets/kit/fonts/BricolageGrotesque-ExtraBold.ttf"),
  KitDMSansRegular: require("../../../assets/kit/fonts/DMSans-Regular.ttf"),
  KitDMSansMedium: require("../../../assets/kit/fonts/DMSans-Medium.ttf"),
  KitDMSansBold: require("../../../assets/kit/fonts/DMSans-Bold.ttf"),
  KitDMSansExtraBold: require("../../../assets/kit/fonts/DMSans-ExtraBold.ttf"),
} as const;

export type KitFontFamilyName = keyof typeof KIT_FONT_ASSETS;

/** Load Bricolage + DM Sans from bundled kit TTFs. */
export function useKitFonts() {
  const [loaded] = useFonts(KIT_FONT_ASSETS);

  useEffect(() => {
    setKitFontsReady(loaded);
  }, [loaded]);

  return loaded;
}
