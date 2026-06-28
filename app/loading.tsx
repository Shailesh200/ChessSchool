/**
 * In-app navigation loader — shown instantly while a route streams in, so a tap
 * never feels dead and the browser's own spinner is never relied on.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-hairline border-t-brand" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">♟️</div>
      </div>
      <p className="text-sm font-extrabold tracking-tight text-ink-500">ChessSchool</p>
    </div>
  );
}
