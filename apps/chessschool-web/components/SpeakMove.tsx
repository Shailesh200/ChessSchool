"use client";

import { copy, language } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type Recognition = {
  lang: string;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type Ctor = new () => Recognition;
const recognizer = () => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Mic button for "Say your move", using the browser's speech recognition. Hidden where the browser has none. */
export function SpeakMove({ disabled, onHeard, onNote }: { disabled: boolean; onHeard: (texts: string[]) => void; onNote: (note: string | null) => void }) {
  const [usable, setUsable] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  // Checked after mount so the server render matches.
  useEffect(() => {
    setUsable(Boolean(recognizer()));
    return () => rec.current?.abort();
  }, []);

  if (!usable) return null;

  const press = () => {
    if (listening) return rec.current?.stop();
    const Rec = recognizer()!;
    const r = new Rec();
    r.lang = language() === "hi" ? "hi-IN" : "en-IN";
    r.maxAlternatives = 5;
    r.onresult = (e) => onHeard(Array.from(e.results[0] ?? [], (a) => a.transcript));
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech") return onNote(copy.play.voice.unclear(""));
      setUsable(false);
      onNote(copy.play.voice.off);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    onNote(copy.play.voice.listening);
    r.start();
  };

  return (
    <button type="button" className={`icon-btn${listening ? " is-listening" : ""}`} aria-label={copy.play.voice.listen} aria-pressed={listening} disabled={disabled && !listening} onClick={press}>
      <Icon name="mic" />
    </button>
  );
}
