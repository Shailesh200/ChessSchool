import { cn } from "./cn";

/** ChessSchool wordmark — Premium kit horizontal logo + legacy crest fallback. */
export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  if (withText) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/kit/logo/chessschool-horizontal-light.svg"
          alt="ChessSchool"
          className="logo-kit-light h-8 w-auto max-w-[11rem] object-contain object-left"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/kit/logo/chessschool-horizontal-dark.svg"
          alt=""
          aria-hidden
          className="logo-kit-dark hidden h-8 w-auto max-w-[11rem] object-contain object-left"
        />
        <span className="cs-wordmark sr-only">
          Chess<b>School</b>
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 40 40" width={32} height={32} aria-hidden className="text-brand">
        <rect x="2" y="2" width="36" height="36" rx="11" fill="currentColor" />
        <path d="M13 30 h14 v-2 l-2-2 v-6 h-10 v6 l-2 2 z" fill="#fff" opacity="0.95" />
        <rect x="14" y="16" width="2.5" height="3" fill="#fff" />
        <rect x="18.75" y="16" width="2.5" height="3" fill="#fff" />
        <rect x="23.5" y="16" width="2.5" height="3" fill="#fff" />
        <path d="M20 7 L31 12 L20 17 L9 12 Z" fill="var(--cs-xp,#FFC857)" />
        <path d="M24 14.7 v3.2 c0 1.6 -8 1.6 -8 0 v-3.2" fill="#e0a92e" />
      </svg>
    </span>
  );
}
