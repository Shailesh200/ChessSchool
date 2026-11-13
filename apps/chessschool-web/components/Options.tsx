"use client";

import { Icon } from "./Icon";

/** Lesson answers in a 2-by-2 grid so a step fits without scrolling. */
export function Options({
  label,
  options,
  selected,
  disabled,
  onChoose,
}: {
  label: string;
  options: { label: string }[];
  selected: number | null;
  disabled?: boolean;
  onChoose: (index: number) => void;
}) {
  return (
    <div className="choices choices-grid" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button key={`${o.label}-${i}`} type="button" role="radio" className="choice" aria-checked={selected === i} disabled={disabled} onClick={() => onChoose(i)}>
          <span>{o.label}</span>
          {selected === i && disabled ? <Icon name="check" /> : null}
        </button>
      ))}
    </div>
  );
}
