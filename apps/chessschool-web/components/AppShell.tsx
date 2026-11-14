"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy, type IconName } from "@chessschool/design";
import { useApp } from "@/lib/state";
import { Icon } from "./Icon";
import { ConnectivityBanner } from "./ConnectivityBanner";
import { Wordmark } from "./Wordmark";
import { Button } from "./ui";

const TABS: { href: string; label: keyof typeof copy.tabs; icon: IconName; also?: string[] }[] = [
  { href: "/today", label: "today", icon: "learn", also: ["/practice"] },
  { href: "/puzzles", label: "puzzles", icon: "puzzle" },
  { href: "/gym", label: "gym", icon: "gym", also: ["/play", "/rooms"] },
  { href: "/you", label: "you", icon: "profile", also: ["/settings"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, ready } = useApp();
  const active = (href: string) => {
    const t = TABS.find((x) => x.href === href)!;
    return [href, ...(t.also ?? [])].some((h) => path === h || path.startsWith(h + "/"));
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="rail" aria-label="Main">
        <Link href="/today" className="rail-brand" aria-label={`${copy.brand} home`}>
          <Wordmark />
        </Link>
        <ul>
          {TABS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="rail-item" aria-current={active(t.href) ? "page" : undefined}>
                <Icon name={t.icon} />
                <span>{copy.tabs[t.label]}</span>
              </Link>
            </li>
          ))}
        </ul>
        {ready && !state.account ? (
          <div className="rail-save">
            <p className="rail-save-title">{copy.today.saveCard.title}</p>
            <p className="rail-save-body">{copy.today.saveCard.body}</p>
            <Button href="/signup" block>
              {copy.today.saveCard.cta}
            </Button>
          </div>
        ) : null}
      </nav>
      <div className="shell-main">
        <ConnectivityBanner />
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="tab" aria-current={active(t.href) ? "page" : undefined}>
            <span className="tab-icon">
              <Icon name={t.icon} />
            </span>
            <span className="tab-label">{copy.tabs[t.label]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
