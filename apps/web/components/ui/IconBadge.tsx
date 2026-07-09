import { Icon, type IconName } from "./Icon";
import { cn } from "./cn";

export type IconTone = "brand" | "gold" | "accent" | "success" | "violet" | "neutral";

const TONE: Record<
  IconTone,
  { shell: string; icon: string; ring?: string }
> = {
  brand: {
    shell:
      "border-brand-100/90 bg-gradient-to-br from-brand-50 via-white to-brand-50/40 text-brand [box-shadow:var(--elev-1)]",
    icon: "text-brand",
    ring: "ring-brand/25",
  },
  gold: {
    shell:
      "border-gold/35 bg-gradient-to-br from-gold/25 via-white to-gold/10 text-gold [box-shadow:var(--elev-1)]",
    icon: "text-gold",
    ring: "ring-gold/30",
  },
  accent: {
    shell:
      "border-accent-400/30 bg-gradient-to-br from-accent-400/15 via-white to-accent-400/5 text-accent-600 [box-shadow:var(--elev-1)]",
    icon: "text-accent-600",
    ring: "ring-accent-400/25",
  },
  success: {
    shell:
      "border-success/30 bg-gradient-to-br from-success/15 via-white to-success/5 text-success-600 [box-shadow:var(--elev-1)]",
    icon: "text-success-600",
    ring: "ring-success/25",
  },
  violet: {
    shell:
      "border-brand-300/40 bg-gradient-to-br from-brand-100/80 via-white to-brand-50/30 text-brand-700 [box-shadow:var(--elev-1)]",
    icon: "text-brand-700",
    ring: "ring-brand-300/30",
  },
  neutral: {
    shell:
      "border-hairline bg-gradient-to-br from-surface-sunken via-white to-surface-sunken/50 text-ink-600 [box-shadow:var(--elev-1)]",
    icon: "text-ink-600",
    ring: "ring-ink-300/20",
  },
};

const DIM = { xs: 28, sm: 36, md: 44, lg: 52, xl: 60 } as const;
export type IconBadgeSize = keyof typeof DIM;

function iconPx(badge: IconBadgeSize) {
  return Math.round(DIM[badge] * 0.46);
}

/** Glyph color class for a tone (plain / inline icons). */
export function iconToneClass(tone: IconTone): string {
  return TONE[tone].icon;
}

/** Premium icon tile — gradient shell, soft border, duotone glyph. */
export function IconBadge({
  name,
  size = "md",
  tone = "brand",
  duotone = true,
  selected,
  className,
  iconClassName,
}: {
  name: IconName;
  size?: IconBadgeSize;
  tone?: IconTone;
  duotone?: boolean;
  selected?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const dim = DIM[size];
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-2xl border",
        "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:bg-gradient-to-b before:from-white/50 before:to-transparent before:opacity-60",
        t.shell,
        selected && cn("ring-2", t.ring),
        className,
      )}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      <Icon
        name={name}
        size={iconPx(size)}
        duotone={duotone}
        className={cn(t.icon, iconClassName)}
      />
    </span>
  );
}

/** Map legacy numeric icon sizes to badge tiers. */
export function badgeSizeFromPx(px: number): IconBadgeSize {
  if (px <= 16) return "xs";
  if (px <= 20) return "sm";
  if (px <= 24) return "md";
  if (px <= 28) return "lg";
  return "xl";
}
