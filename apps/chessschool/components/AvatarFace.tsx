import { AVATARS, copy, type AvatarId } from "@chessschool/design";
import { Image, Pressable, View } from "react-native";
import { Cody } from "@/components/Lottie";
import { useTheme } from "@/lib/theme";

const ART: Record<Exclude<AvatarId, "cody">, number> = {
  otto: require("../assets/coaches/otto.png"),
  kira: require("../assets/coaches/kira.png"),
  skye: require("../assets/coaches/skye.png"),
  ash: require("../assets/coaches/ash.png"),
  rex: require("../assets/coaches/rex.png"),
};

export function AvatarFace({ id, size = 68 }: { id: AvatarId; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center" }}>
      {id === "cody" ? <Cody animation="idle" size={size - 6} /> : <Image source={ART[id]} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />}
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
          <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={id === "cody" ? "Cody" : id[0].toUpperCase() + id.slice(1)} onPress={() => onChange(id)} style={{ alignItems: "center", gap: 4, width: 84 }}>
            <View style={{ borderRadius: 40, borderWidth: 3, borderColor: on ? c.brand : "transparent" }}>
              <AvatarFace id={id} size={72} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
