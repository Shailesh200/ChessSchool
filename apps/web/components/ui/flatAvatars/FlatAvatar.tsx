import { cn } from "../cn";
import { FlatAvatarArt } from "./art";
import {
  FLAT_AVATAR_TONES,
  type FlatAvatarId,
  resolveFlatAvatar,
} from "./catalog";

const SIZE = { sm: 44, md: 56, lg: 68, xl: 84 } as const;
export type FlatAvatarSize = keyof typeof SIZE;

/** Flat illustrated portrait — gradient tile + original character art. */
export function FlatAvatar({
  id,
  size = "md",
  selected,
  className,
}: {
  id: FlatAvatarId | string;
  size?: FlatAvatarSize | number;
  selected?: boolean;
  className?: string;
}) {
  const resolved = resolveFlatAvatar(id);
  const tone = FLAT_AVATAR_TONES[resolved];
  const px = typeof size === "number" ? size : SIZE[size];
  const pad = Math.round(px * 0.08);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2",
        "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:bg-gradient-to-b before:from-white/45 before:to-transparent",
        selected && "ring-2 ring-offset-2 ring-offset-[var(--surface-card)]",
        className,
      )}
      style={{
        width: px,
        height: px,
        borderColor: tone.ring,
        background: `linear-gradient(145deg, ${tone.from}, ${tone.to})`,
        ...(selected ? { boxShadow: `0 0 0 2px ${tone.ring}` } : {}),
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 96 96"
        width={px - pad}
        height={px - pad}
        className="relative z-[1]"
      >
        <FlatAvatarArt id={resolved} />
      </svg>
    </span>
  );
}

export function flatAvatarPx(size: FlatAvatarSize): number {
  return SIZE[size];
}
