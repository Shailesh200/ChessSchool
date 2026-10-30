import { useFonts } from "expo-font";
import { useEffect } from "react";
import { setKitFontsReady } from "./mapTokens";

/** Load Bricolage + DM Sans from bundled kit woff2 (web + native where supported). */
export function useKitFonts() {
  const [loaded] = useFonts({
    KitBricolageExtraBold: require("../../../assets/kit/fonts/BricolageGrotesque-var-latin.woff2"),
    KitDMSansRegular: require("../../../assets/kit/fonts/DMSans-var-latin.woff2"),
    KitDMSansMedium: require("../../../assets/kit/fonts/DMSans-var-latin.woff2"),
    KitDMSansBold: require("../../../assets/kit/fonts/DMSans-var-latin.woff2"),
  });

  useEffect(() => {
    setKitFontsReady(loaded);
  }, [loaded]);

  return loaded;
}
