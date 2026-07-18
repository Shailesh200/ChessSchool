"use client";

import { useState } from "react";
import {
  COACH_CHARACTER_LIST,
  type CoachCharacterId,
} from "@/features/coaching/characters";
import { CoachAvatar } from "@/components/ui/coachCharacters/CoachAvatar";
import {
  previewCoachCharacter,
  stopCoachSpeech,
} from "@/core/audio/coachSpeech";

export function CoachCharacterPicker({
  value,
  onChange,
}: {
  value: CoachCharacterId;
  onChange: (id: CoachCharacterId) => void;
}) {
  const [previewing, setPreviewing] = useState<CoachCharacterId | null>(null);

  async function pick(id: CoachCharacterId) {
    onChange(id);
    stopCoachSpeech();
    setPreviewing(id);
    try {
      await previewCoachCharacter(id);
    } finally {
      setPreviewing((cur) => (cur === id ? null : cur));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {COACH_CHARACTER_LIST.map((c) => {
        const on = value === c.id;
        const busy = previewing === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => void pick(c.id)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              on
                ? "border-[var(--brand-500)] bg-[color-mix(in_srgb,var(--brand-500)_10%,transparent)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand-300)]"
            }`}
            aria-pressed={on}
          >
            <CoachAvatar
              character={c.id}
              state={busy ? "speak" : on ? "idle" : "breathe"}
              size="md"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[var(--ink)]">
                {c.name}
              </span>
              <span className="block text-xs text-[var(--muted)]">{c.theme}</span>
            </span>
            {on ? (
              <span className="text-xs font-medium text-[var(--brand-600)]">
                Active
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
