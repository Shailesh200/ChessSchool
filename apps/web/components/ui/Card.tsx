import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-hairline bg-surface-card p-5 [box-shadow:var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}
