"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { useReducedMotion } from "@/core/hooks/useReducedMotion";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/** Kit tarball lottie-ui assets (copied to /public/kit/lottie). */
export type KitLottieId =
  | "confetti"
  | "error-shake"
  | "loader"
  | "loader-dark"
  | "logo-splash-dark"
  | "logo-splash-light"
  | "streak-flame"
  | "success-burst"
  | "xp-pop"
  | "xp-pop-20"
  | "xp-pop-50";

const JSON_SRC: Record<KitLottieId, string> = {
  confetti: "/kit/lottie/confetti.json",
  "error-shake": "/kit/lottie/error-shake.json",
  loader: "/kit/lottie/loader.json",
  "loader-dark": "/kit/lottie/loader-dark.json",
  "logo-splash-dark": "/kit/lottie/logo-splash-dark.json",
  "logo-splash-light": "/kit/lottie/logo-splash-light.json",
  "streak-flame": "/kit/lottie/streak-flame.json",
  "success-burst": "/kit/lottie/success-burst.json",
  "xp-pop": "/kit/lottie/xp-pop.json",
  "xp-pop-20": "/kit/lottie/xp-pop-20.json",
  "xp-pop-50": "/kit/lottie/xp-pop-50.json",
};

const STILL_SRC: Record<KitLottieId, string> = {
  confetti: "/kit/lottie/stills/confetti.png",
  "error-shake": "/kit/lottie/stills/error-shake.png",
  loader: "/kit/lottie/stills/loader.png",
  "loader-dark": "/kit/lottie/stills/loader-dark.png",
  "logo-splash-dark": "/kit/lottie/stills/logo-splash-dark.png",
  "logo-splash-light": "/kit/lottie/stills/logo-splash-light.png",
  "streak-flame": "/kit/lottie/stills/streak-flame.png",
  "success-burst": "/kit/lottie/stills/success-burst.png",
  "xp-pop": "/kit/lottie/stills/xp-pop.png",
  "xp-pop-20": "/kit/lottie/stills/xp-pop-20.png",
  "xp-pop-50": "/kit/lottie/stills/xp-pop-50.png",
};

/**
 * Lazy kit Lottie with PNG still under reduced motion (matches design-kit screens.css).
 */
export function KitLottie({
  id,
  className,
  loop = false,
  stillClassName,
  "data-testid": testId,
}: {
  id: KitLottieId;
  className?: string;
  loop?: boolean;
  stillClassName?: string;
  "data-testid"?: string;
}) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<object | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    setLoaded(false);
    fetch(JSON_SRC[id])
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) {
          setData(json);
          setLoaded(true);
        }
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [id, reduced]);

  const showAnim = !reduced && data;

  return (
    <span
      className={cn("lot", className)}
      data-lot={id}
      data-testid={testId ?? `kit-lottie-${id}`}
      data-kit-lottie-loaded={loaded ? "1" : "0"}
      aria-hidden
    >
      {showAnim ? (
        <Lottie animationData={data} loop={loop} className="h-full w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={cn("lot__still", stillClassName)}
          src={STILL_SRC[id]}
          alt=""
          data-testid={`kit-lottie-still-${id}`}
        />
      )}
    </span>
  );
}
