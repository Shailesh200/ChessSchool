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
    return <div className="flex min-h-dvh flex-col bg-surface">{children}</div>;
  }
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <InstallPrompt />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
