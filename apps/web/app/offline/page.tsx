"use client";

import Link from "next/link";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
  return (
    <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Mascot expression="happy" size={120} />
      <h1 className="text-ink text-2xl font-extrabold">You&apos;re offline</h1>
      <p className="text-ink-500 max-w-xs text-sm font-semibold">
        No connection — but ChessSchool works offline! Your classes and games are right
        here.
      </p>
      <Link href="/">
        <Button size="lg">Keep learning</Button>
      </Link>
    </div>
  );
}
