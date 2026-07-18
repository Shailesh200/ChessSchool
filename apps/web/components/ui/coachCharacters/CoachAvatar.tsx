"use client";

import type { CSSProperties } from "react";
import {
  coachCharacterOf,
  type CoachAvatarState,
  type CoachCharacterId,
} from "@/features/coaching/characters";

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
};

export function CoachAvatar({
  character,
  state = "idle",
  size = "md",
  className = "",
  alt,
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="coach-avatar__img"
        src={c.imageSrc}
        alt={alt ?? `${c.name}, ${c.theme} coach`}
        width={px}
        height={px}
        draggable={false}
      />
    </span>
  );
}
