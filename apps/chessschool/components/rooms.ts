import type { CodyAnimation, IconName, Palette, RoomId } from "@chessschool/design";

export const ROOM_META: Record<RoomId, { icon: IconName; pose: CodyAnimation; tint: (c: Palette) => string; edge: (c: Palette) => string; href: "/gym" | "/practice" | "/rooms/club"; open: boolean }> = {
  play: { icon: "play", pose: "thinking", tint: (c) => c.brandSoft, edge: (c) => c.brand, href: "/gym", open: true },
  practice: { icon: "practice", pose: "proud", tint: (c) => c.dangerSoft, edge: (c) => c.accent, href: "/practice", open: true },
  club: { icon: "club", pose: "love", tint: (c) => c.goldSoft, edge: (c) => c.gold, href: "/rooms/club", open: false },
};
