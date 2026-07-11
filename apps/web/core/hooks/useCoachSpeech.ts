"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  speakCoachLine,
  speakCoachText,
  stopCoachSpeech,
  coachTextAlreadyQueued,
} from "@/core/audio/coachSpeech";
import type { CoachContext } from "@/features/coaching/personality";
import { useSettings } from "@/core/store/settings.store";

/**
 * Speak bubble text when it changes (Google Cloud TTS + personality retint).
 */
export function useCoachSpeech(
  text: string,
  context: CoachContext,
  enabled = true,
  /** When true, `text` is already personality-styled (lesson bubble display). */
  styled = false,
) {
  const coachSpeech = useSettings((s) => s.coachSpeech);
  const sound = useSettings((s) => s.sound);
  const personality = useSettings((s) => s.coachPersonality);
  const lastSpoken = useRef("");

  useLayoutEffect(() => {
    if (!enabled || !sound || !coachSpeech) return;
    const line = text.trim();
    if (!line || line === lastSpoken.current) return;
    if (coachTextAlreadyQueued(line)) {
      lastSpoken.current = line;
      return;
    }
    lastSpoken.current = line;
    if (styled) void speakCoachText(line);
    else void speakCoachLine(line, context, personality);
  }, [text, context, enabled, sound, coachSpeech, personality, styled]);

  useEffect(() => () => stopCoachSpeech(), []);
}
