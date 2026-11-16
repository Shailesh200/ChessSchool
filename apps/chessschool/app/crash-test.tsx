import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

/**
 * Device tests only (EXPO_PUBLIC_DEVICE_TEST=1 at build time): `chessschool://crash-test` throws while rendering,
 * `?kind=timer` throws a fatal error outside React. Every other build sends this link to Learn.
 */
export default function CrashTest() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const armed = process.env.EXPO_PUBLIC_DEVICE_TEST === "1";
  useEffect(() => {
    if (!armed || kind !== "timer") return;
    const t = setTimeout(() => {
      throw new Error("Crash test: fatal error outside React");
    }, 300);
    return () => clearTimeout(t);
  }, [armed, kind]);
  if (!armed) return <Redirect href="/today" />;
  if (kind !== "timer") throw new Error("Crash test: fatal error while rendering");
  return null;
}
