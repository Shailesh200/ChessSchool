"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";
import {
  COACH_VOICE_GROUPS,
  COACH_VOICE_OPTIONS,
  normalizeCoachVoice,
} from "@/lib/tts/voices";
import { CoachVoiceFace } from "@/components/ui/coachVoiceFaces/CoachVoiceFace";
import { previewCoachVoice, stopCoachSpeech } from "@/core/audio/coachSpeech";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";
import { Icon } from "@/components/ui/Icon";
import { listContainer, listItem } from "@/core/motion/variants";

function voiceLabel(id: CoachVoiceId): string {
  return COACH_VOICE_OPTIONS.find((v) => v.id === id)?.title ?? id;
}

function voiceHint(id: CoachVoiceId): string {
  return COACH_VOICE_OPTIONS.find((v) => v.id === id)?.hint ?? "";
}

/** Grid of flat human face tiles — pick who reads coach lines aloud. */
export function CoachVoicePicker({
  value,
  personality,
  onChange,
}: {
  value: CoachVoiceId;
  personality: CoachPersonality;
  onChange: (id: CoachVoiceId) => void;
}) {
  const [previewing, setPreviewing] = useState<CoachVoiceId | null>(null);
  const previewSession = useRef(0);
  const active = normalizeCoachVoice(value);

  useEffect(() => () => stopCoachSpeech(), []);

  async function pick(id: CoachVoiceId) {
    const canonical = normalizeCoachVoice(id);
    const session = ++previewSession.current;

    stopCoachSpeech();
    setPreviewing(null);

    haptics.fire("select");
    audio.play("select");
    onChange(canonical);
    setPreviewing(canonical);

    try {
      await previewCoachVoice(canonical);
    } finally {
      if (previewSession.current === session) {
        setPreviewing(null);
      }
    }
  }

  return (
    <motion.div
      variants={listContainer}
      initial="initial"
      animate="enter"
      className="flex flex-col gap-4"
    >
      {COACH_VOICE_GROUPS.map((group) => (
        <motion.div key={group.label} variants={listItem} className="flex flex-col gap-2">
          <p className="text-ink-500 text-[10px] font-extrabold tracking-wide uppercase">
            {group.label}
          </p>
          <div
            className={
              group.ids.length === 1
                ? "max-w-[9rem]"
                : "grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-7"
            }
          >
            {group.ids.map((id) => {
              const selected = active === id;
              const playing = previewing === id;
              const hint =
                id === "auto"
                  ? `Follows ${personality} coach style`
                  : voiceHint(id);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => void pick(id)}
                  aria-pressed={selected}
                  aria-label={`${voiceLabel(id)}. ${hint}`}
                  className={`btn-tactile rounded-card flex flex-col items-center gap-1.5 border-2 p-2 transition-colors ${
                    selected
                      ? "border-brand bg-brand-50"
                      : "border-hairline bg-surface-card hover:border-brand-200"
                  }`}
                >
                  <CoachVoiceFace
                    id={id}
                    size={64}
                    selected={selected}
                    playing={playing}
                  />
                  <span className="text-ink w-full truncate text-center text-[11px] leading-tight font-extrabold">
                    {voiceLabel(id)}
                  </span>
                  <span className="text-ink-400 line-clamp-2 w-full text-center text-[9px] leading-snug font-semibold">
                    {hint}
                  </span>
                  {selected && (
                    <span className="text-brand inline-flex items-center gap-0.5 text-[9px] font-extrabold">
                      <Icon name="check" size={10} />
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
