"use client";

import { NavButton } from "@/components/ui/NavButton";
import { useSession } from "@/core/store/session.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { trackEvent } from "@/core/analytics/track";

/** Hero / footer CTAs that respect cookie session (don't push enrolled users to /register). */
export function LandingPrimaryCtas({
  enrollLabel,
  size = "lg",
}: {
  enrollLabel: string;
  size?: "sm" | "md" | "lg";
}) {
  const authed = useSession((s) => s.authed);
  const rehydrateReady = useRehydrateReady();
  const sessionPending = !rehydrateReady || authed === null;
  const showAuthed = rehydrateReady && authed === true;

  if (sessionPending) {
    return (
      <div className="flex flex-wrap gap-2">
        <div className="skeleton h-11 w-36 rounded-full" aria-hidden />
        <div className="skeleton h-11 w-40 rounded-full" aria-hidden />
      </div>
    );
  }

  if (showAuthed) {
    return (
      <NavButton href="/academy" size={size}>
        Continue to academy →
      </NavButton>
    );
  }

  return (
    <>
      <NavButton
        href="/register"
        size={size}
        onClick={() => trackEvent("enroll_cta_click", { source: "hero" })}
      >
        {enrollLabel}
      </NavButton>
      <NavButton href="/academy" variant="outline" size={size}>
        Explore academy
      </NavButton>
    </>
  );
}
