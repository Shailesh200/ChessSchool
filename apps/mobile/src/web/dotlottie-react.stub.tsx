/**
 * Web-only stub for `@lottiefiles/dotlottie-react` (Metro alias in metro.config.js).
 * Lets Expo web export/run without adding the optional dotlottie npm peer.
 * Native Android/iOS still use real lottie-react-native — unchanged.
 */
import { useEffect, useRef } from "react";
import { View, type ViewStyle } from "react-native";

type DotLottieInstance = {
  play: () => void;
  pause: () => void;
  setFrame: (_frame: number) => void;
  setSegment: (_start: number, _end: number) => void;
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  removeEventListener: (event: string) => void;
};

type Props = {
  dotLottieRefCallback?: (instance: DotLottieInstance | null) => void;
  data?: unknown;
  src?: string;
  style?: ViewStyle;
  autoplay?: boolean;
  speed?: number;
  loop?: boolean;
  playOnHover?: boolean;
  mode?: "forward" | "reverse";
};

export function DotLottieReact({ dotLottieRefCallback, style }: Props) {
  const handlers = useRef(new Map<string, (...args: unknown[]) => void>());
  const instance = useRef<DotLottieInstance | null>(null);

  useEffect(() => {
    const mock: DotLottieInstance = {
      play: () => {
        handlers.current.get("complete")?.(false);
      },
      pause: () => undefined,
      setFrame: () => undefined,
      setSegment: () => undefined,
      addEventListener: (event, handler) => {
        handlers.current.set(event, handler);
      },
      removeEventListener: (event) => {
        handlers.current.delete(event);
      },
    };
    instance.current = mock;
    dotLottieRefCallback?.(mock);
    queueMicrotask(() => handlers.current.get("load")?.());
    return () => {
      dotLottieRefCallback?.(null);
      instance.current = null;
    };
  }, [dotLottieRefCallback]);

  return <View style={[{ minHeight: 1, minWidth: 1 }, style]} />;
}
