"use client";

import { countryName, flagOf, type AvatarId } from "@chessschool/design";
import { useState } from "react";
import { Cody } from "./Lottie";

/**
 * A learner's face: their uploaded photo when there is one (and it loads), else the preset avatar.
 * `country`: an ISO code shown as a small bordered flag badge on the bottom-right (leaderboards, profiles).
 */
export function MemberFace({ id, size, photo, country }: { id: AvatarId; size: number; photo?: string | null; country?: string | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  const face = (
    <span className="member-face" style={{ width: size, height: size }} aria-hidden>
      {photo && broken !== photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={size} height={size} onError={() => setBroken(photo)} />
      ) : id === "cody" ? <Cody animation="idle" size={size - 6} /> : <img src={`/coaches/${id}.png`} alt="" width={size} height={size} />}
    </span>
  );
  if (!country) return face;
  const badge = Math.max(16, Math.round(size * 0.42));
  return (
    <span className="member-face-wrap" style={{ width: size, height: size }}>
      {face}
      <span className="member-flag" role="img" aria-label={countryName(country)} style={{ width: badge, height: badge, fontSize: Math.round(badge * 0.62) }}>
        {flagOf(country)}
      </span>
    </span>
  );
}
