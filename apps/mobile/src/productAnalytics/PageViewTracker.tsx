import { useEffect, useRef } from "react";
import { usePathname, useGlobalSearchParams } from "expo-router";
import { useAuth } from "@/auth";
import { trackEvent } from "@/productAnalytics/track";
import { routePattern } from "@/productAnalytics/routePattern";

/** Fires `page_view` on Expo Router navigations (opt-in via shareAnalytics). */
export function PageViewTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const { user, guest } = useAuth();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const qs = Object.keys(params ?? {})
      .sort()
      .map((k) => `${k}=${String(params[k] ?? "")}`)
      .join("&");
    const key = `${pathname}?${qs}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const route = routePattern(pathname);
    trackEvent(
      "page_view",
      {
        route,
        authed: Boolean(user && !guest),
        search: qs ? 1 : 0,
        referrer: "mobile",
      },
      pathname,
    );
  }, [pathname, params, user, guest]);

  return null;
}
