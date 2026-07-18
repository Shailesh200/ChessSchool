"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/ui/Mascot";
import { pullProgress } from "@/core/sync/pullProgress";

/**
 * Post-login/sign-up interstitial — pulls the account's profile + progress and
 * shows a full-page "enrolling" loader so the UI never flashes guest data first.
 */
export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeShell />}>
      <WelcomeRedirect />
    </Suspense>
  );
}

function WelcomeShell() {
  return (
    <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Mascot expression="happy" size={96} />
      <div className="border-surface-sunken border-t-brand h-10 w-10 animate-spin rounded-full border-4" />
      <div>
        <p className="text-ink text-base font-extrabold">
          Enrolling you into the academy…
        </p>
        <p className="text-ink-500 mt-1 text-xs font-semibold">
          Loading your profile and progress
        </p>
      </div>
    </div>
  );
}

function WelcomeRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/academy";

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

  return <WelcomeShell />;
}
