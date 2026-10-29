"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import {
  coachCharacterOf,
  type CoachAvatarState,
  type CoachCharacterId,
} from "@/features/coaching/characters";

const DeferredCoachImage = dynamic(() => import("./CoachAvatarImage"), {
  ssr: false,
  loading: () => <span className="coach-avatar__img" aria-hidden />,
});

const SIZE = {
  sm: 40,
  md: 56,
  lg: 72,
  xl: 96,
} as const;

export type CoachAvatarSize = keyof typeof SIZE | number;

type Props = {
  character: CoachCharacterId | string;
  state?: CoachAvatarState;
  size?: CoachAvatarSize;
  className?: string;
  alt?: string;
  /**
   * Keep the sized frame in the first paint and fetch the portrait after mount.
   * Settings uses this so the coach line is not stuck behind the portrait preloads.
   */
  deferImage?: boolean;
};

export function CoachAvatar({
  character,
  state = "idle",
  size = "md",
  className = "",
  alt,
  deferImage = false,
}: Props) {
  const c = coachCharacterOf(character);
  const px = typeof size === "number" ? size : SIZE[size];
  const successClass =
    c.successMotion === "nod" ? "coach-avatar--nod" : "coach-avatar--celebrate";
  const signatureClass = `coach-avatar--${c.signatureMotion}`;

  const stateClass =
    state === "success"
      ? successClass
      : state === "signature"
        ? signatureClass
        : `coach-avatar--${state}`;

  return (
    <span
      className={`coach-avatar ${stateClass} ${className}`.trim()}
      style={
        {
          width: px,
          height: px,
          ["--coach-accent" as string]: c.accent,
        } as CSSProperties
      }
      data-character={c.id}
      data-state={state}
    >
      <span className="coach-avatar__ring" aria-hidden />
      {deferImage ? (
        <DeferredCoachImage
          src={c.imageSrc}
          alt={alt ?? `${c.name}, ${c.theme} coach`}
          px={px}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="coach-avatar__img"
          src={c.imageSrc}
          alt={alt ?? `${c.name}, ${c.theme} coach`}
          width={px}
          height={px}
          draggable={false}
        />
      )}
    </span>
  );
}
