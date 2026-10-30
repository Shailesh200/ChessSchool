"use client";

import { useState } from "react";

/**
 * Loads a kit asset. Until it loads, and if it 404s, shows a letter on a soft glow
 * instead of a broken image.
 */
export function KitPortrait({
  src,
  alt,
  label,
  className,
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  return (
    <span className={className}>
      {ready ? null : (
        <span className="kit-portrait-fallback" aria-hidden="true">
          {label.slice(0, 1)}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={ready ? alt : ""}
        hidden={!ready}
        onLoad={() => setReady(true)}
        onError={() => setReady(false)}
      />
    </span>
  );
}
