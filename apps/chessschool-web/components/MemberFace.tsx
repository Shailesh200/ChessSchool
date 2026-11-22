"use client";

import type { AvatarId } from "@chessschool/design";
import { useState } from "react";
import { Cody } from "./Lottie";

/** A learner's face: their uploaded photo when there is one (and it loads), else the preset avatar. */
export function MemberFace({ id, size, photo }: { id: AvatarId; size: number; photo?: string | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <span className="member-face" style={{ width: size, height: size }} aria-hidden>
      {photo && broken !== photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={size} height={size} onError={() => setBroken(photo)} />
      ) : id === "cody" ? <Cody animation="idle" size={size - 6} /> : <img src={`/coaches/${id}.png`} alt="" width={size} height={size} />}
    </span>
  );
}
