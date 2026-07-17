"use client";

import { useRef, useState } from "react";
import { FlatAvatar } from "@/components/ui/flatAvatars/FlatAvatar";
import { Icon } from "@/components/ui/Icon";
import { resolveAvatar } from "@/components/ui/iconMaps";
import { Button } from "@/components/ui/Button";
import { toast } from "@/core/store/toast.store";

export function StudentIdCard({
  name,
  email,
  studentNo,
  rank,
  house,
  enrolled,
  avatar,
}: {
  name: string;
  email: string;
  studentNo: string;
  rank: string;
  house: string;
  enrolled: string;
  avatar: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `chessschool-id-${studentNo}.png`;
      a.click();
      toast("Student ID downloaded", { icon: "check", tone: "success" });
    } catch {
      toast("Couldn't export the card", { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={cardRef}
        className="rounded-card from-brand to-brand-700 overflow-hidden bg-gradient-to-br p-5 text-white [box-shadow:var(--shadow-pop)]"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold tracking-widest uppercase opacity-80">
            ChessSchool · Student ID
          </span>
          <Icon name="cap" size={22} className="text-white" />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-1">
            <FlatAvatar id={resolveAvatar(avatar)} size={76} className="rounded-xl" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold">{name}</p>
            <p className="truncate text-sm font-semibold opacity-80">{email}</p>
            <p className="mt-1 font-mono text-sm font-bold tracking-wider">
              {studentNo}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs font-bold opacity-90">
          <span>Rank · {rank}</span>
          <span>House · {house}</span>
          <span>Since · {enrolled}</span>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={download} disabled={busy}>
        <Icon name="arrowRight" size={16} className="rotate-90" />
        {busy ? "Exporting…" : "Download ID card"}
      </Button>
    </div>
  );
}
