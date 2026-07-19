"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/core/analytics/track";
import { routeArea, routePattern } from "@/lib/analytics/routePattern";
import { useSession } from "@/core/store/session.store";

/**
 * Fires `page_view` on client navigations (App Router).
 * Respects Do Not Track + Settings → Share usage analytics via trackEvent.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authed = useSession((s) => s.authed);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString() ?? "";
    const key = `${pathname}?${qs}`;
    // Guard React Strict Mode double-invoke + identical re-renders.
    if (lastKey.current === key) return;
    lastKey.current = key;

    let referrer = "direct";
    try {
      if (document.referrer) {
        const host = new URL(document.referrer).host;
        referrer = host || "direct";
      }
    } catch {
      referrer = "direct";
    }

    const route = routePattern(pathname);
    trackEvent("page_view", {
      route,
      area: routeArea(route),
      referrer,
      authed: authed === true,
      search: qs ? 1 : 0,
    });
  }, [pathname, searchParams, authed]);

  return null;
}
