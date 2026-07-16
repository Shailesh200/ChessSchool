import { useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenLoader } from "@/ScreenLoader";
import { fetchProgress } from "@/progressStore";
import { loadSettingsFromAccount } from "@/settings";

/** Brief sync screen after login — mirrors web `/welcome`. */
export default function WelcomeScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const target = typeof next === "string" && next.startsWith("/") ? next : "/(tabs)/academy";
    const safety = setTimeout(() => router.replace(target as never), 6000);
    void Promise.all([fetchProgress(true), loadSettingsFromAccount()])
      .catch(() => void 0)
      .finally(() => {
        setTimeout(() => {
          clearTimeout(safety);
          router.replace(target as never);
        }, 500);
      });
    return () => clearTimeout(safety);
  }, [next, router]);

  return <ScreenLoader variant="fullscreen" label="Syncing your progress…" />;
}
