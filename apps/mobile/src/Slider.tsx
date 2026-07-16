import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";
import { useAppTheme } from "./ThemeProvider";
import { radius } from "./theme";

/**
 * Tap/drag slider. Uses pageX vs track origin so parent re-renders (text scale)
 * cannot jump the thumb mid-drag. Commits onChange while dragging for stepped
 * values; releases clear the local draft.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const { colors } = useAppTheme();
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const trackX = useRef(0);
  const widthRef = useRef(1);
  const lastEmit = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const shown = drag ?? value;
  const pct = Math.max(0, Math.min(1, (shown - min) / (max - min || 1)));

  useEffect(() => {
    if (drag == null) lastEmit.current = value;
  }, [value, drag]);

  const computeFromPageX = (pageX: number) => {
    const x = pageX - trackX.current;
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    const v = Math.round((min + ratio * (max - min)) / step) * step;
    return Math.max(min, Math.min(max, v));
  };

  const apply = (pageX: number, release: boolean) => {
    const v = computeFromPageX(pageX);
    setDrag(release ? null : v);
    if (release || v !== lastEmit.current) {
      lastEmit.current = v;
      onChangeRef.current(v);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => apply(e.nativeEvent.pageX, false),
      onPanResponderMove: (e) => apply(e.nativeEvent.pageX, false),
      onPanResponderRelease: (e) => apply(e.nativeEvent.pageX, true),
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  return (
    <View
      style={styles.wrap}
      onLayout={(e: LayoutChangeEvent) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
        setW(widthRef.current);
        e.target.measureInWindow?.((x: number) => {
          trackX.current = x;
        });
      }}
      {...pan.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: colors.surfaceSunken }]} pointerEvents="none">
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.brand }]} />
      </View>
      <View
        style={[
          styles.thumb,
          { left: `${pct * 100}%`, backgroundColor: colors.brand, borderColor: colors.surfaceCard },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 36, justifyContent: "center" },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    borderWidth: 3,
    shadowColor: "#1c1b2e",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
