import { useEffect, useLayoutEffect, useRef } from "react";
import { AppState } from "react-native";
import { prefetchCoachText, speakCoachText, stopCoachSpeech } from "./coachSpeech";
import { useSettings } from "./settings";

/** Speak coach bubble text when it changes (cloud TTS via /api/tts). */
export function useCoachSpeech(text: string, enabled = true) {
  const { sound, coachSpeech } = useSettings();
  const lastSpoken = useRef("");

  useEffect(() => {
    if (!enabled || !sound || !coachSpeech) {
      stopCoachSpeech();
      lastSpoken.current = "";
    }
  }, [enabled, sound, coachSpeech]);

  useLayoutEffect(() => {
    if (!enabled || !sound || !coachSpeech) return;
    const line = text.trim();
    if (!line || line === "Thinking…" || line === lastSpoken.current) return;
    lastSpoken.current = line;
    void prefetchCoachText(line);
    void speakCoachText(line);
  }, [text, enabled, sound, coachSpeech]);

  useEffect(() => () => stopCoachSpeech(), []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") stopCoachSpeech();
    });
    return () => sub.remove();
  }, []);
}
