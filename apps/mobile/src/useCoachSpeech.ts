import { useEffect, useLayoutEffect, useRef } from "react";
import { prefetchCoachText, speakCoachText, stopCoachSpeech } from "./coachSpeech";
import { useSettings } from "./settings";

/** Speak coach bubble text when it changes (cloud TTS via /api/tts). */
export function useCoachSpeech(text: string, enabled = true) {
  const { sound, coachSpeech } = useSettings();
  const lastSpoken = useRef("");

  useLayoutEffect(() => {
    if (!enabled || !sound || !coachSpeech) return;
    const line = text.trim();
    if (!line || line === "Thinking…" || line === lastSpoken.current) return;
    lastSpoken.current = line;
    void prefetchCoachText(line);
    void speakCoachText(line);
  }, [text, enabled, sound, coachSpeech]);

  useEffect(() => () => stopCoachSpeech(), []);
}
