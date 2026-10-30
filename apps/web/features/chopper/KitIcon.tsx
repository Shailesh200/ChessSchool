import { cn } from "@/components/ui/cn";

/** Kit Lucide sprite (`public/kit/icons/sprite.svg`). */
export function KitIcon({
  name,
  className,
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <svg className={cn("ico", fill && "fill", className)} aria-hidden="true">
      <use href={`/kit/icons/sprite.svg#i-${name}`} />
    </svg>
  );
}
