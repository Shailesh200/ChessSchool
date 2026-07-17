/** Campus loading skeleton — semester rows + resume block (MOTION.md). */
export function CampusSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="rounded-card border-hairline bg-surface-card skeleton h-24 border" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="skeleton rounded-pill h-7 w-36" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1].map((j) => (
              <div
                key={j}
                className="rounded-card border-hairline bg-surface-card skeleton h-28 border"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
