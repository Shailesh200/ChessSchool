"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/core/store/session.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";

/** Redirect guests to enroll before enrolled-only play surfaces. */
export function EnrollGate({
  children,
  next,
}: {
  children: ReactNode;
  next: string;
}) {
  const router = useRouter();
  const authed = useSession((s) => s.authed);
  const ready = useRehydrateReady();

  useEffect(() => {
    if (!ready) return;
    if (authed !== true) {
      router.replace(`/register?next=${encodeURIComponent(next)}`);
    }
  }, [ready, authed, router, next]);

  if (!ready || authed !== true) {
    return <div className="skeleton rounded-card mx-auto mt-8 h-64 max-w-xl" />;
  }

  return children;
}
