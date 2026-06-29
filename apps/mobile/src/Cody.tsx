import { Image } from "react-native";
import { API_URL } from "./api";

export type CodyExpression = "happy" | "think" | "cheer" | "sad" | "wave";

/**
 * Cody — the same premium 3D mascot art as web, served from the backend's
 * /mascots folder. (Bundled offline assets can come later.)
 */
export function Cody({ expression = "happy", size = 120 }: { expression?: CodyExpression; size?: number }) {
  return (
    <Image
      source={{ uri: `${API_URL}/mascots/cody-${expression}-v2.png` }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
