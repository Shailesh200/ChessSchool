import { useEffect, useRef } from "react";
import { Keyboard, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";

// Room for the field plus the button that usually follows it.
const GAP = 112;

/** Keeps the focused input above the keyboard inside a ScrollView (Android doesn't do this itself). */
export function useKeyboardScroll() {
  const ref = useRef<ScrollView>(null);
  const y = useRef(0);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", (e) => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input || !ref.current) return;
      input.measureInWindow((_x, top, _w, height) => {
        const overlap = top + height + GAP - e.endCoordinates.screenY;
        if (overlap > 0) ref.current?.scrollTo({ y: y.current + overlap, animated: true });
      });
    });
    return () => sub.remove();
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.current = e.nativeEvent.contentOffset.y;
  };

  return { ref, onScroll, scrollEventThrottle: 32 };
}
