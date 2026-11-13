"use client";

import { codyLoops, codyPoster, type CodyAnimation, type FxAnimation } from "@chessschool/design";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import { useReducedMotion } from "@/lib/hooks";

const LottiePlayer = dynamic(() => import("lottie-react"), { ssr: false });

const jsonCache = new Map<string, Promise<object>>();
function loadJson(url: string) {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`lottie ${url}`);
      return r.json();
    });
    jsonCache.set(url, p);
  }
  return p;
}

type PlayerProps = {
  src: string;
  loop: boolean;
  poster: number;
  size: number;
  label?: string;
  fallback?: React.ReactNode;
  onComplete?: () => void;
  className?: string;
};

function Player({ src, loop, poster, size, label, fallback, onComplete, className }: PlayerProps) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<object | null>(null);
  const ref = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    let alive = true;
    loadJson(src)
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    if (reduced && data) ref.current?.goToAndStop(poster, true);
  }, [reduced, data, poster]);

  useEffect(() => {
    if (reduced && data && onComplete) onComplete();
  }, [reduced, data, onComplete]);

  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, flex: "none" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {data ? (
        <LottiePlayer
          lottieRef={ref}
          animationData={data}
          loop={reduced ? false : loop}
          autoplay={!reduced}
          onComplete={reduced ? undefined : onComplete}
          style={{ width: size, height: size }}
          rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

export function Cody({
  animation = "idle",
  size = 120,
  label,
  onComplete,
  className,
}: {
  animation?: CodyAnimation;
  size?: number;
  label?: string;
  onComplete?: () => void;
  className?: string;
}) {
  return (
    <Player
      key={animation}
      src={`/assets/lottie/cody/${animation}.json`}
      loop={codyLoops[animation]}
      poster={codyPoster[animation]}
      size={size}
      label={label}
      onComplete={onComplete}
      className={className}
      fallback={<img src="/assets/svg/cody.svg" alt="" width={size} height={size} />}
    />
  );
}

const fxPoster: Record<FxAnimation, number> = { "xp-pop": 26, "streak-spark": 30, stamp: 28, "error-shake": 36, "splash-mark": 60 };

export function Fx({ name, size = 96, onComplete, className }: { name: FxAnimation; size?: number; onComplete?: () => void; className?: string }) {
  return <Player key={name} src={`/assets/lottie/fx/${name}.json`} loop={false} poster={fxPoster[name]} size={size} onComplete={onComplete} className={className} />;
}
