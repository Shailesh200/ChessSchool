"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NavButton } from "@/components/ui/NavButton";
import { useSession } from "@/core/store/session.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";

/** Marketing shell — no bottom nav; academy lives under /academy. */
export function LandingShell({ children }: { children: React.ReactNode }) {
  const authed = useSession((s) => s.authed);
  const rehydrateReady = useRehydrateReady();
  // null = ProgressSync still validating cookie — don't flash Enroll for logged-in users.
  const sessionPending = !rehydrateReady || authed === null;
  const showAuthed = rehydrateReady && authed === true;

  return (
    <div className="bg-surface flex min-h-dvh flex-col">
      <header className="pt-safe border-hairline bg-surface/90 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" aria-label="ChessSchool home">
            <Logo withText />
          </Link>
          <div className="flex items-center gap-2">
            {sessionPending ? (
              <div
                className="skeleton h-9 w-28 rounded-full"
                aria-hidden
                data-testid="landing-auth-pending"
              />
            ) : showAuthed ? (
              <NavButton href="/academy" size="sm">
                Continue to academy
              </NavButton>
            ) : (
              <>
                <NavButton href="/login" variant="ghost" size="sm">
                  Log in
                </NavButton>
                <NavButton href="/register" size="sm">
                  Enroll free
                </NavButton>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
      <footer className="border-hairline border-t px-5 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-500 text-xs font-semibold">
            © {new Date().getFullYear()} ChessSchool · Free chess academy
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
            <Link href="/academy" className="text-brand hover:underline">
              Academy
            </Link>
            <Link href="/library" className="text-ink-500 hover:text-ink">
              Library
            </Link>
            <Link href="/learn-chess" className="text-ink-500 hover:text-ink">
              Learn chess
            </Link>
            <Link href="/about" className="text-ink-500 hover:text-ink">
              About
            </Link>
            <Link href="/support" className="text-ink-500 hover:text-ink">
              Support
            </Link>
            <Link href="/terms" className="text-ink-500 hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="text-ink-500 hover:text-ink">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
