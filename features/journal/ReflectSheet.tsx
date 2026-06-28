"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { addJournalEntry, type JournalEntry } from "@/core/db/db";
import { isoDay } from "@/core/store/progression.store";
import { audio } from "@/core/audio/audioEngine";
import { toast } from "@/core/store/toast.store";

const CONFIDENCE = ["😣", "😕", "😐", "🙂", "😄"];

/** Post-activity reflection capture (#14) — confidence + a quick note. */
export function ReflectSheet({
  open,
  onClose,
  kind,
  title,
  summary,
  refId,
}: {
  open: boolean;
  onClose: () => void;
  kind: JournalEntry["kind"];
  title: string;
  summary: string;
  refId: string | null;
}) {
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    await addJournalEntry({
      id: `j${Date.now()}`,
      day: isoDay(),
      date: Date.now(),
      kind,
      title,
      confidence,
      note: note.trim(),
      summary,
      ref: refId,
    });
    setSaved(true);
    audio.play("success");
    toast("Saved to your journal", { icon: "journal", tone: "success" });
    window.setTimeout(() => {
      setSaved(false);
      setNote("");
      onClose();
    }, 700);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add to your journal">
      <p className="mb-1 text-sm font-bold text-ink">{title}</p>
      <p className="mb-4 text-xs font-semibold text-ink-500">{summary}</p>

      <label className="mb-1 block text-xs font-extrabold text-ink-700">How confident do you feel?</label>
      <div className="mb-4 flex justify-between">
        {CONFIDENCE.map((emoji, i) => (
          <button
            key={i}
            onClick={() => setConfidence(i + 1)}
            aria-label={`Confidence ${i + 1} of 5`}
            className={`flex h-11 w-11 items-center justify-center rounded-pill text-xl transition-transform ${
              confidence === i + 1 ? "scale-110 bg-brand-50 ring-2 ring-brand" : "bg-surface-sunken"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs font-extrabold text-ink-700" htmlFor="note">
        What did you learn? Biggest mistake? Plan?
      </label>
      <textarea
        id="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="A line or two for future-you…"
        className="mb-4 w-full rounded-card border border-hairline bg-surface p-3 text-sm font-semibold text-ink"
      />

      <div className="flex gap-2">
        <Button variant="ghost" block onClick={onClose}>Skip</Button>
        <Button block onClick={save}>{saved ? "✓ Saved" : "Save entry"}</Button>
      </div>
    </Sheet>
  );
}
