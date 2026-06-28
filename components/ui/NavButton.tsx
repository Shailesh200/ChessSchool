"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "./Button";

/**
 * A Button that navigates and shows a spinner until the destination route is
 * ready (#13) — so tapping "Admin" etc. gives immediate feedback.
 */
export function NavButton({
  href,
  onClick,
  children,
  ...rest
}: ButtonProps & { href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      {...rest}
      loading={pending}
      onClick={(e) => {
        onClick?.(e);
        startTransition(() => router.push(href));
      }}
    >
      {children}
    </Button>
  );
}
