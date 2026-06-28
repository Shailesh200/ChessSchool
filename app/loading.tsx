/**
 * Shown instantly while a route loads — gives immediate feedback on navigation
 * (so a slow page never feels like a dead tap).
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-hairline border-t-brand" />
    </div>
  );
}
