"use client";

import Link from "next/link";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <Mascot expression="happy" size={120} />
      <h1 className="text-2xl font-extrabold text-ink">You&apos;re offline</h1>
      <p className="max-w-xs text-sm font-semibold text-ink-500">
        No connection — but ChessSchool works offline! Your classes and games are right here.
      </p>
      <Link href="/">
        <Button size="lg">Keep learning</Button>
      </Link>
    </div>
  );
}
