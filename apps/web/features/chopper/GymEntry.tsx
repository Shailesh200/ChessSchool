"use client";

import { useRouter } from "next/navigation";
import { useSettings } from "@/core/store/settings.store";
import { GymScreen } from "./GymScreen";
import { StateSheet, type SheetKind } from "./StateSheet";

const SHEETS: SheetKind[] = ["empty", "error", "offline"];

export function GymEntry({
  fixture = false,
  sheet,
}: {
  fixture?: boolean;
  sheet?: string;
}) {
  const uiKit = useSettings((s) => s.uiKit);
  const router = useRouter();
  const kind = SHEETS.find((s) => s === sheet);

  if (uiKit === "legacy" && !kind) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-ink text-xl font-extrabold">Gym</h1>
        <p className="text-ink-500 text-sm font-semibold">
          Puzzle drills live in your lessons. Open a class from Learn to practice.
        </p>
      </div>
    );
  }

  if (kind) {
    return (
      <StateSheet
        kind={kind}
        fixture={fixture || Boolean(kind)}
        onClose={() => router.push("/gym")}
      />
    );
  }
  return <GymScreen fixture={fixture} />;
}
