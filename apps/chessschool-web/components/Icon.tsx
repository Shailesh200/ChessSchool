import { googleMark, icons, type IconName } from "@chessschool/design";

export function Icon({ name, size = 24, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {icons[name].map((p, i) =>
        "fill" in p && p.fill ? (
          <path key={i} d={p.d} fill="currentColor" stroke="none" opacity={p.opacity ?? 1} />
        ) : (
          <path key={i} d={p.d} />
        ),
      )}
    </svg>
  );
}

export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {googleMark.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  );
}
