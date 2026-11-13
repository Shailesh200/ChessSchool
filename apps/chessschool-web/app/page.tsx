"use client";

import { copy, motion } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Cody, Fx } from "@/components/Lottie";
import { Wordmark } from "@/components/Wordmark";
import { useApp } from "@/lib/state";

export default function Splash() {
  const { ready, state } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    // Signed-out first launch opens Log in. Welcome runs after signup or guest.
    const dest = state.account || state.seenWelcome ? "/today" : "/login";
    router.prefetch(dest);
    const t = setTimeout(() => router.replace(dest), motion.duration.splash);
    return () => clearTimeout(t);
  }, [ready, state.account, state.seenWelcome, router]);

  return (
    <div className="splash" aria-busy="true" aria-label={copy.splash.loading}>
      <div className="splash-stage">
        <Fx name="splash-mark" size={132} className="splash-mark" />
        <Cody animation="wave" size={150} label={copy.a11y.mascot} />
      </div>
      <Wordmark size="lg" />
      <p className="splash-tag">{copy.tagline}</p>
    </div>
  );
}
