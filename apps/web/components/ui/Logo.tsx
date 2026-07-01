import { cn } from "./cn";

/** ChessSchool wordmark + academic crest (graduation cap over a rook). */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 40 40" width={32} height={32} aria-hidden>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="#3b35a0" />
        {/* rook */}
        <path d="M13 30 h14 v-2 l-2-2 v-6 h-10 v6 l-2 2 z" fill="#fff" opacity="0.95" />
        <rect x="14" y="16" width="2.5" height="3" fill="#fff" />
        <rect x="18.75" y="16" width="2.5" height="3" fill="#fff" />
        <rect x="23.5" y="16" width="2.5" height="3" fill="#fff" />
        {/* graduation cap */}
        <path d="M20 7 L31 12 L20 17 L9 12 Z" fill="#f6c343" />
        <path d="M24 14.7 v3.2 c0 1.6 -8 1.6 -8 0 v-3.2" fill="#e0a92e" />
        <circle cx="31" cy="12" r="1.4" fill="#f6c343" />
        <path d="M31 12 v4" stroke="#f6c343" strokeWidth="1" />
      </svg>
      {withText && (
        <span className="text-xl font-extrabold tracking-tight text-ink">
          Chess<span className="text-brand">School</span>
        </span>
      )}
    </span>
  );
}
