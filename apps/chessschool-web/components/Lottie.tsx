"use client";

import { codyClip, codyLoops, codyPoster, type CodyAnimation, type CodyClip, type FxAnimation } from "@chessschool/design";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
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

/** Chaukor fills about half of his 512 canvas (room for jumps); drawn this much larger so he reads at every size. */
const CODY_ZOOM = 1.4;
/** Zoomed around his body (a little below the canvas centre); the overflow is only empty canvas or a jump. */
const zoomed = (size: number, zoom: number): React.CSSProperties =>
  zoom === 1 ? { width: size, height: size } : { width: size * zoom, height: size * zoom, margin: `${(size - size * zoom) / 2 - size * zoom * 0.06}px 0 0 ${(size - size * zoom) / 2}px` };

function Player({ src, loop, poster, size, label, fallback, onComplete, className, zoom = 1 }: PlayerProps & { zoom?: number }) {
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
          style={zoomed(size, zoom)}
          rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

/** Chaukor. One-shot clips settle back to idle when they finish; reduced motion shows the clip's poster frame. */
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
  const clip = codyClip(animation);
  return <CodyClipPlayer key={clip} clip={clip} size={size} label={label} onComplete={onComplete} className={className} />;
}

function CodyClipPlayer({ clip, size, label, onComplete, className }: { clip: CodyClip; size: number; label?: string; onComplete?: () => void; className?: string }) {
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const now = settled ? "idle" : clip;
  const finish = useCallback(() => {
    onComplete?.();
    if (!reduced && !codyLoops[clip]) setSettled(true);
  }, [onComplete, reduced, clip]);
  return (
    <Player
      key={now}
      src={`/assets/lottie/cody/${now}.json`}
      loop={codyLoops[now]}
      poster={codyPoster[now]}
      size={size}
      label={label}
      onComplete={settled ? undefined : finish}
      className={className}
      fallback={<img src="/assets/svg/cody.svg" alt="" style={zoomed(size, CODY_ZOOM)} />}
      zoom={CODY_ZOOM}
    />
  );
}

const fxPoster: Record<FxAnimation, number> = { "xp-pop": 26, "streak-spark": 30, stamp: 28, "error-shake": 36, "splash-mark": 60 };

export function Fx({ name, size = 96, onComplete, className }: { name: FxAnimation; size?: number; onComplete?: () => void; className?: string }) {
  return <Player key={name} src={`/assets/lottie/fx/${name}.json`} loop={false} poster={fxPoster[name]} size={size} onComplete={onComplete} className={className} />;
}
