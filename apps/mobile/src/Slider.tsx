import { useRef, useState } from "react";
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";
import { colors, radius } from "./theme";

/**
 * Tap/drag slider. Flicker-free: a local `drag` value drives the visual (no
 * dependency on the parent re-rendering), `onChange` only fires when the
 * *stepped* value changes, and the children are pointer-transparent so the
 * touch x stays relative to the track.
 */
export function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const lastEmit = useRef(value);
  const shown = drag ?? value;
  const pct = Math.max(0, Math.min(1, (shown - min) / (max - min)));

  const compute = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / w));
    const v = Math.round((min + ratio * (max - min)) / step) * step;
    return Math.max(min, Math.min(max, v));
  };
  const apply = (x: number, release: boolean) => {
    const v = compute(x);
    setDrag(release ? null : v);
    if (release || v !== lastEmit.current) {
      lastEmit.current = v;
      onChange(v);
    }
  };
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => apply(e.nativeEvent.locationX, false),
    onPanResponderMove: (e) => apply(e.nativeEvent.locationX, false),
    onPanResponderRelease: (e) => apply(e.nativeEvent.locationX, true),
    onPanResponderTerminate: () => setDrag(null),
  });

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: `${pct * 100}%` }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 28, justifyContent: "center" },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  thumb: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, marginLeft: -10, borderWidth: 3, borderColor: "#fff", shadowColor: "#1c1b2e", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});
