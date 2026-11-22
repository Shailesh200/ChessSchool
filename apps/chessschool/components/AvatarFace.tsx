import { AVATARS, copy, countryName, flagOf, type AvatarId } from "@chessschool/design";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Cody } from "@/components/Lottie";
import { useTheme } from "@/lib/theme";

const ART: Record<Exclude<AvatarId, "cody">, number> = {
  otto: require("../assets/coaches/otto.png"),
  kira: require("../assets/coaches/kira.png"),
  skye: require("../assets/coaches/skye.png"),
  ash: require("../assets/coaches/ash.png"),
  rex: require("../assets/coaches/rex.png"),
};

/** A learner's face: their uploaded photo when there is one (and it loads), else the preset avatar. */
/** `country`: an ISO code shown as a small flag badge on the bottom-right of the face (leaderboards, profiles). */
export function AvatarFace({ id, size = 68, photo, country }: { id: AvatarId; size?: number; photo?: string | null; country?: string | null }) {
  const { c } = useTheme();
  const [broken, setBroken] = useState<string | null>(null);
  const face = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center" }}>
      {photo && broken !== photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} onError={() => setBroken(photo)} accessibilityIgnoresInvertColors />
      ) : id === "cody" ? <Cody animation="idle" size={size - 6} /> : <Image source={ART[id]} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />}
    </View>
  );
  if (!country) return face;
  const badge = Math.max(16, Math.round(size * 0.42));
  return (
    <View style={{ width: size, height: size }}>
      {face}
      <View
        accessible
        accessibilityLabel={countryName(country)}
        style={{ position: "absolute", right: -2, bottom: -2, width: badge, height: badge, borderRadius: badge / 2, borderWidth: 2, borderColor: c.card, backgroundColor: c.card, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        <Text allowFontScaling={false} style={{ fontSize: badge * 0.62, lineHeight: badge * 0.8, textAlign: "center" }}>
          {flagOf(country)}
        </Text>
      </View>
    </View>
  );
}

export function AvatarPicker({ value, onChange }: { value: AvatarId; onChange: (id: AvatarId) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={copy.you.avatar} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
      {AVATARS.map((id) => {
        const on = id === value;
        return (
          <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={id === "cody" ? "Chaukor" : id[0].toUpperCase() + id.slice(1)} onPress={() => onChange(id)} style={{ alignItems: "center", gap: 4, width: 84 }}>
            <View style={{ borderRadius: 40, borderWidth: 3, borderColor: on ? c.brand : "transparent" }}>
              <AvatarFace id={id} size={72} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
