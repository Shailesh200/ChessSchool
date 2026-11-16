"use client";

import { celebrationShare, celebrationText, copy, type FxAnimation } from "@chessschool/design";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { Cody, Fx } from "./Lottie";
import { Button, useToast } from "./ui";

const FX: Record<string, FxAnimation> = { unit: "stamp", streak: "streak-spark", rank: "xp-pop", rating: "xp-pop", league: "xp-pop" };
/** Shown on the main tabs only, never over a lesson, puzzle or game. */
const HOME = ["/today", "/puzzles", "/gym", "/you"];

/** Text to the share sheet when the browser has one, else to the clipboard. Returns true when it was copied. */
export async function shareText(text: string): Promise<boolean> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return false;
    } catch (err) {
      // The learner closed the share sheet: nothing more to do. Any other failure falls back to copying.
      if ((err as { name?: string })?.name === "AbortError") return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first queued celebration as a full-screen modal dialog, once. The Lottie art holds a still
 * frame and the dialog does not animate when Reduce motion is on (globals.css).
 */
export function CelebrationOverlay() {
  const { state, ready, dismissCelebration, cue } = useApp();
  const path = usePathname();
  const toast = useToast();
  const course = useCourse();
  const ref = useRef<HTMLDialogElement>(null);
  const next = ready ? state.pendingCelebrations[0] : undefined;
  const nextId = next?.id ?? null;
  const active = HOME.includes(path);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !nextId) return;
    const t = setTimeout(() => {
      setShown(nextId);
      cue("level-up");
    }, 700);
    return () => clearTimeout(t);
  }, [active, nextId, cue]);

  const open = Boolean(next && shown === next.id);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  if (!next || !open) return null;
  const unitTitle = next.kind === "unit" ? course?.units.find((u) => u.id === next.unit)?.title : undefined;
  const text = celebrationText(next, unitTitle);
  const close = () => dismissCelebration(next.id);
  return (
    <dialog ref={ref} className="celebration" aria-labelledby="celebration-title" aria-describedby="celebration-body" data-kind={next.kind} onClose={close}>
      <div className="celebration-art" aria-hidden>
        <Fx name={FX[next.kind]} size={170} className="celebration-fx" />
        <Cody animation="celebrate" size={170} />
      </div>
      <h1 id="celebration-title">{text.title}</h1>
      <p id="celebration-body" className="lead">
        {text.body}
      </p>
      <div className="celebration-actions">
        <Button block autoFocus onClick={close}>
          {copy.celebrate.continue}
        </Button>
        <Button block variant="secondary" onClick={() => void shareText(celebrationShare(next, unitTitle)).then((copied) => copied && toast(copy.celebrate.copied))}>
          {copy.celebrate.share}
        </Button>
      </div>
    </dialog>
  );
}
