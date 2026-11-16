import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

const THREW = "crash-test:threw";

/**
 * Device tests only (EXPO_PUBLIC_DEVICE_TEST=1 at build time): `chessschool://crash-test` throws while rendering,
 * `?kind=timer` throws a fatal error outside React. Every other build sends this link to Learn.
 * It throws once: if Restart reloads the app back onto this route, it goes to Learn instead of crashing again.
 */
export default function CrashTest() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const armed = process.env.EXPO_PUBLIC_DEVICE_TEST === "1";
  const [step, setStep] = useState<"check" | "throw" | "done">("check");
  useEffect(() => {
    if (!armed) return;
    AsyncStorage.getItem(THREW)
      .then(async (v) => {
        if (v) return void (await AsyncStorage.removeItem(THREW), setStep("done"));
        await AsyncStorage.setItem(THREW, "1");
        setStep("throw");
      })
      .catch(() => setStep("throw"));
  }, [armed]);
  useEffect(() => {
    if (step !== "throw" || kind !== "timer") return;
    const t = setTimeout(() => {
      throw new Error("Crash test: fatal error outside React");
    }, 300);
    return () => clearTimeout(t);
  }, [step, kind]);
  if (!armed || step === "done") return <Redirect href="/today" />;
  if (step === "throw" && kind !== "timer") throw new Error("Crash test: fatal error while rendering");
  return null;
}
