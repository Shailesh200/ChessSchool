import { Icon, type IconName } from "./Icon";
import {
  achievementIcon,
  botTierIcon,
  emojiToIcon,
  emojiToTone,
  type IconTone,
} from "./iconMaps";
import { IconBadge, badgeSizeFromPx, iconToneClass } from "./IconBadge";
import { cn } from "./cn";

/** Premium icon for DB emoji strings (lessons, classes, achievements…). */
export function ContentIcon({
  emoji,
  achievementId,
  botName,
  name,
  size = 24,
  className,
  iconClassName,
  duotone = true,
  variant = "badge",
  tone,
  selected,
  accentColor,
}: {
  emoji?: string | null;
  achievementId?: string;
  botName?: string;
  name?: IconName;
  size?: number;
  className?: string;
  iconClassName?: string;
  duotone?: boolean;
  /** badge = gradient tile (default); plain = glyph only; inline = compact for text rows */
  variant?: "badge" | "plain" | "inline";
  tone?: IconTone;
  selected?: boolean;
  /** Tint glyph on coloured surfaces (class cards, semester chips). */
  accentColor?: string;
}) {
  const icon =
    name ??
    (achievementId ? achievementIcon(achievementId) : undefined) ??
    (botName ? botTierIcon(botName) : undefined) ??
    emojiToIcon(emoji ?? "");

  const resolvedTone =
    tone ??
    (achievementId ? achievementIconTone(achievementId) : undefined) ??
    emojiToTone(emoji ?? "") ??
    "brand";

  if (variant === "inline") {
    return (
      <Icon
        name={icon}
        size={size}
        duotone={duotone}
        className={cn(iconToneClass(resolvedTone), "shrink-0", className, iconClassName)}
        style={accentColor ? { color: accentColor } : undefined}
      />
    );
  }

  if (variant === "plain") {
    return (
      <Icon
        name={icon}
        size={size}
        duotone={duotone}
        className={cn(iconToneClass(resolvedTone), "shrink-0", className, iconClassName)}
        style={accentColor ? { color: accentColor } : undefined}
      />
    );
  }

  return (
    <IconBadge
      name={icon}
      size={badgeSizeFromPx(size)}
      tone={resolvedTone}
      duotone={duotone}
      selected={selected}
      className={className}
      iconClassName={iconClassName}
    />
  );
}

function achievementIconTone(id: string): IconTone {
  if (id.startsWith("streak")) return "accent";
  if (id.includes("win") || id === "giant-slayer") return "gold";
  if (id.startsWith("rated") || id === "centurion") return "violet";
  if (id.startsWith("scholar") || id === "graduate") return "brand";
  return "gold";
}
