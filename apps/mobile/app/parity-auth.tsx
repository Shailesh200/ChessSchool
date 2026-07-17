import { useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenLoader } from "@/ScreenLoader";
import { useAuth } from "@/auth";

/** Dev-only: seed a session from the parity harness (Bearer token from API login). */
export default function ParityAuthScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { adoptSessionToken } = useAuth();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_PARITY !== "1") {
      router.replace("/");
      return;
    }
    if (started.current) return;
    started.current = true;
    const raw = typeof token === "string" ? token.trim() : "";
    if (!raw) {
      router.replace("/login");
      return;
    }
    void adoptSessionToken(raw)
      .then(() => router.replace("/welcome"))
      .catch(() => router.replace("/login"));
  }, [adoptSessionToken, router, token]);

  return <ScreenLoader variant="fullscreen" label="Parity sign-in…" />;
}
