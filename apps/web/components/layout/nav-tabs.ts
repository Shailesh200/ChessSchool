import type { IconName } from "@/components/ui/Icon";

export type NavTab = { href: string; label: string; icon: IconName };

/** Primary tab routes — shared by mobile bottom nav and desktop sidebar. */
export const NAV_TABS: NavTab[] = [
  { href: "/academy", label: "Learn", icon: "learn" },
  { href: "/play", label: "Play", icon: "play" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

export function isNavTabActive(pathname: string, href: string): boolean {
  return href === "/academy" ? pathname === "/academy" : pathname.startsWith(href);
}
