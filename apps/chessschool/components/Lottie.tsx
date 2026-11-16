import { codyClip, codyLoops, codyPoster, type CodyAnimation, type CodyClip, type FxAnimation } from "@chessschool/design";
import { useNavigation } from "expo-router";
import LottieView, { type AnimationObject } from "lottie-react-native";
import { useState, useSyncExternalStore } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { codySources, fxSources } from "@/lib/assets";
import { useReducedMotion } from "@/lib/hooks";

const frames = (src: object) => (src as { op?: number }).op ?? 60;

/** Tab screens stay mounted; only the screen in front should animate. */
function useScreenFocused(): boolean {
  const nav = useNavigation();
  return useSyncExternalStore(
    (cb) => {
      const offFocus = nav.addListener("focus", cb);
      const offBlur = nav.addListener("blur", cb);
      return () => {
        offFocus();
        offBlur();
      };
    },
    () => nav.isFocused(),
  );
}

function Player({ source, loop, poster, size, label, onFinish, style }: { source: object; loop: boolean; poster: number; size: number; label?: string; onFinish?: () => void; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const focused = useScreenFocused();
  const still = reduced || !focused;
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    >
      <LottieView
        key={still ? "still" : "live"}
        source={source as AnimationObject}
        autoPlay={!still}
        loop={still ? false : loop}
        progress={still ? poster / frames(source) : undefined}
        onAnimationFinish={still ? undefined : (cancelled) => !cancelled && onFinish?.()}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

/** Chaukor. One-shot clips settle back to idle when they finish; reduced motion shows the clip's poster frame. */
export function Cody({ animation = "idle", size = 120, label, onFinish, style }: { animation?: CodyAnimation; size?: number; label?: string; onFinish?: () => void; style?: StyleProp<ViewStyle> }) {
  const clip = codyClip(animation);
  return <CodyClipPlayer key={clip} clip={clip} size={size} label={label} onFinish={onFinish} style={style} />;
}

function CodyClipPlayer({ clip, size, label, onFinish, style }: { clip: CodyClip; size: number; label?: string; onFinish?: () => void; style?: StyleProp<ViewStyle> }) {
  const [settled, setSettled] = useState(false);
  const now = settled ? "idle" : clip;
  const finish = () => {
    onFinish?.();
    if (!codyLoops[clip]) setSettled(true);
  };
  return <Player key={now} source={codySources[now]} loop={codyLoops[now]} poster={codyPoster[now]} size={size} label={label} onFinish={settled ? undefined : finish} style={style} />;
}

const fxPoster: Record<FxAnimation, number> = { "xp-pop": 26, "streak-spark": 30, stamp: 28, "error-shake": 36, "splash-mark": 60 };

export function Fx({ name, size = 96, style }: { name: FxAnimation; size?: number; style?: StyleProp<ViewStyle> }) {
  return <Player key={name} source={fxSources[name]} loop={false} poster={fxPoster[name]} size={size} style={style} />;
}
