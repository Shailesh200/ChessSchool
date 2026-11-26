import type { BotId } from "@chessschool/chess";
import { botArt, botMotion, isCharacterBot, type BotMood } from "@chessschool/design";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useReducedMotion } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";
import { Cody } from "./Lottie";

/**
 * A bot as its own chess-piece character (Pip the pawn … King Atlas the king), moving in its own rhythm for
 * the moment of the game (`mood`). Chaukor is the mascot and keeps its Lottie. Below 40px the speech bubble
 * and sparkles are left out so the face stays readable.
 */
export function BotAvatar({ bot, size = 44, mood = "wait" }: { bot: BotId; size?: number; mood?: BotMood }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const cb = isCharacterBot(bot) ? bot : null;
  const art = useMemo(() => (cb ? botArt(cb, mood) : null), [cb, mood]);
  const m = cb ? botMotion(cb, mood) : null;
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!m || reduced) return;
    t.setValue(0);
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: m.ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [m?.ms, m?.name, reduced, t]); // eslint-disable-line react-hooks/exhaustive-deps -- restart only when the motion changes

  if (!art || !m) {
    return (
      <View importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.brandSoft, overflow: "hidden" }}>
        <Cody animation="idle" size={size} />
      </View>
    );
  }
  const at = m.frames.map((f) => f.at);
  const unit = size / 240;
  const lerp = (k: "x" | "y" | "r" | "sx" | "sy", scale = 1) => t.interpolate({ inputRange: at, outputRange: m.frames.map((f) => f[k] * scale) });
  const move = reduced
    ? undefined
    : {
        transformOrigin: "50% 88%",
        transform: [{ translateX: lerp("x", unit) }, { translateY: lerp("y", unit) }, { rotate: t.interpolate({ inputRange: at, outputRange: m.frames.map((f) => `${f.r}deg`) }) }, { scaleX: lerp("sx") }, { scaleY: lerp("sy") }],
      };
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Animated.View style={[{ position: "absolute", inset: 0 }, move]}>
        <SvgXml xml={art.body} width={size} height={size} />
      </Animated.View>
      {art.fx && size >= 40 ? <SvgXml xml={art.fx} width={size} height={size} style={{ position: "absolute" }} /> : null}
    </View>
  );
}
