import { FlatAvatar } from "@/components/ui/flatAvatars/FlatAvatar";
import { botAvatarForElo, botAvatarForName } from "./bots";

/** Branded bot portrait — flat character on a tier-colored tile. */
export function BotAvatar({
  elo,
  size = 56,
  className,
  selected,
}: {
  elo: number;
  size?: number;
  className?: string;
  selected?: boolean;
}) {
  return (
    <FlatAvatar
      id={botAvatarForElo(elo)}
      size={size}
      selected={selected}
      className={className}
    />
  );
}

/** Portrait by bot display name. */
export function BotAvatarByName({
  name,
  size = 56,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return <FlatAvatar id={botAvatarForName(name)} size={size} className={className} />;
}
