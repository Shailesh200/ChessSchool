"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useMatch } from "@/core/store/match.store";
import { useSettings } from "@/core/store/settings.store";
import { useMounted } from "@/core/hooks/useMounted";

/** Persists top/bottom chrome across Learn · Play · Review · Profile navigations. */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const active = useMatch((s) => s.active);
  const uiKit = useSettings((s) => s.uiKit);
  const focus =
    mounted && pathname.startsWith("/play") && Boolean(active) && uiKit === "legacy";
  const bare = pathname === "/play" && uiKit !== "legacy";

  return (
    <AppShell focus={focus} bare={bare}>
      {children}
    </AppShell>
  );
}
