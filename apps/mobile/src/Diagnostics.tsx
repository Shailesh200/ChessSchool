import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "./auth";
import { useSettings } from "./settings";

/** Tiny FPS + route HUD — admin + Settings toggle only. */
export function Diagnostics() {
  const { diagnostics } = useSettings();
  const { user } = useAuth();
  const allowed = diagnostics && user?.role === "admin";
  const pathname = usePathname();
  const [fps, setFps] = useState(0);
  const count = useRef(0);
  const last = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!allowed) return;
    const loop = (t: number) => {
      count.current += 1;
      if (last.current === 0) last.current = t;
      if (t - last.current >= 1000) {
        setFps(count.current);
        count.current = 0;
        last.current = t;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [allowed]);

  if (!allowed) return null;

  return (
    <View style={styles.hud} pointerEvents="none">
      <Text style={styles.text}>
        {fps} fps · {pathname}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: "absolute",
    right: 8,
    bottom: 88,
    zIndex: 60,
    backgroundColor: "rgba(28,27,46,0.85)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
  },
});
