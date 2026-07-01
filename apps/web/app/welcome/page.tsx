"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/ui/Mascot";
import { pullProgress } from "@/core/sync/pullProgress";

/**
 * Post-login/sign-up interstitial — pulls the account's profile + progress and
 * shows a full-page "enrolling" loader so the UI never flashes guest data first.
 */
export default function WelcomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      router.replace(next);
    };
    pullProgress().finally(() => setTimeout(go, 500));
    const safety = setTimeout(go, 6000); // never hang
    return () => clearTimeout(safety);
  }, [router, next]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <Mascot expression="happy" size={96} />
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-sunken border-t-brand" />
      <div>
        <p className="text-base font-extrabold text-ink">Enrolling you into the academy…</p>
        <p className="mt-1 text-xs font-semibold text-ink-500">Loading your profile and progress</p>
      </div>
    </div>
  );
}
