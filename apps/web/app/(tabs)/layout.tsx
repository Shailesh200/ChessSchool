"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useMatch } from "@/core/store/match.store";
import { useMounted } from "@/core/hooks/useMounted";

/** Persists top/bottom chrome across Learn · Play · Review · Profile navigations. */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const active = useMatch((s) => s.active);
  const focus =
    mounted && pathname.startsWith("/play") && Boolean(active && !active.finished);

  return <AppShell focus={focus}>{children}</AppShell>;
}
