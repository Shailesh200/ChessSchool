"use client";

import { copy, motion, startRoute } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Cody } from "@/components/Lottie";
import { Wordmark } from "@/components/Wordmark";
import { useApp } from "@/lib/state";

export default function Splash() {
  const { ready, state } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    // A new visitor goes straight into the first lesson; welcome and the account offer come after it.
    const dest = startRoute(state);
    router.prefetch(dest);
    const t = setTimeout(() => router.replace(dest), dest === "/today" ? motion.duration.splash : 300);
    return () => clearTimeout(t);
    // Decided once, when the saved state has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, router]);

  return (
    <div className="splash" aria-busy="true" aria-label={copy.splash.loading}>
      <div className="splash-stage">
        <Cody animation="wave" size={150} label={copy.a11y.mascot} />
      </div>
      <Wordmark size="lg" />
      <p className="splash-tag">{copy.tagline}</p>
    </div>
  );
}
