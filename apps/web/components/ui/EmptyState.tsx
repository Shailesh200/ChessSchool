import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

/** Premium empty state — illustration from plans/design/assets/svg/empty/. */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
}: {
  illustration: "library" | "review";
  title: string;
  description: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border-hairline bg-surface-sunken/40 flex flex-col items-center border border-dashed px-6 py-8 text-center",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/svg/empty/empty-${illustration}.svg`}
        alt=""
        width={240}
        height={180}
        className="mx-auto h-auto w-full max-w-[200px]"
      />
      <p className="text-ink mt-4 text-sm font-extrabold">{title}</p>
      <p className="text-ink-500 mt-1 max-w-xs text-xs leading-relaxed font-semibold">
        {description}
      </p>
      {action && (
        <Link href={action.href} className="mt-4">
          <Button size="sm">{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
