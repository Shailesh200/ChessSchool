"use client";

import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/**
 * Standard chrome for the main tabbed screens. In `focus` mode (an active
 * match) the top/bottom chrome is hidden for an immersive, board-first view.
 */
export function AppShell({
  children,
  focus = false,
}: {
  children: React.ReactNode;
  focus?: boolean;
}) {
  if (focus) {
    return <div className="bg-surface flex min-h-dvh flex-col">{children}</div>;
  }
  return (
    <div className="bg-surface flex h-dvh flex-col overflow-hidden">
      <a
        href="#main-content"
        className="focus:bg-surface-card focus:text-ink sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-bold"
      >
        Skip to main content
      </a>
      <TopBar />
      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 py-5 lg:max-w-4xl"
      >
        <InstallPrompt />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
