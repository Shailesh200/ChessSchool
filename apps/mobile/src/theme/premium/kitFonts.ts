import { useFonts } from "expo-font";
import { useEffect } from "react";
import { setKitFontsReady } from "./mapTokens";

/** Load Bricolage + DM Sans from bundled kit woff2 (web + native where supported). */
export function useKitFonts() {
  const [loaded] = useFonts({
    KitBricolageExtraBold: require("../../../assets/kit/fonts/BricolageGrotesque-ExtraBold.ttf"),
    KitDMSansRegular: require("../../../assets/kit/fonts/DMSans-Medium.ttf"),
    KitDMSansMedium: require("../../../assets/kit/fonts/DMSans-Medium.ttf"),
    KitDMSansBold: require("../../../assets/kit/fonts/DMSans-Bold.ttf"),
  });

  useEffect(() => {
    setKitFontsReady(loaded);
  }, [loaded]);

  return loaded;
}
