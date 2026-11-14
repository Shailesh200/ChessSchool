"use client";

import { COACHES, copy, type CoachId } from "@chessschool/design";
import { Icon } from "@/components/Icon";
import { playClip, useClips } from "@/lib/voice";

/** The four coaches as radio rows. Recorded coaches play a sample line when picked. */
export function CoachPicker({ value, onChange }: { value: CoachId | null; onChange: (id: CoachId) => void }) {
  return (
    <div className="choices" role="radiogroup" aria-label={copy.coach.title}>
      {COACHES.map((coach) => (
        <CoachRow key={coach.id} id={coach.id} name={coach.name} blurb={coach.blurb} selected={value === coach.id} onPick={() => onChange(coach.id)} />
      ))}
    </div>
  );
}

function CoachRow({ id, name, blurb, selected, onPick }: { id: CoachId; name: string; blurb: string; selected: boolean; onPick: () => void }) {
  // A line from the second lesson doubles as the sample.
  const clips = useClips(id, "board");
  const sample = clips ? Object.values(clips)[0] : undefined;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className="choice coach-choice"
      onClick={() => {
        onPick();
        if (sample) playClip(sample);
      }}
    >
      <span className="coach-text">
        <strong>{name}</strong>
        <span className="muted">{blurb}</span>
      </span>
      {clips && !sample ? <span className="chip">{copy.coach.soon}</span> : <Icon name={selected ? "check" : "sound"} />}
    </button>
  );
}
