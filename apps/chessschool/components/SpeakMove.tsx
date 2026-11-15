import { copy, language } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import type { ExpoSpeechRecognitionModule as SpeechModule } from "expo-speech-recognition";
import { Button } from "@/components/ui";

// Missing in builds made before the module shipped: then there is no mic button.
let Speech: typeof SpeechModule | null = null;
try {
  Speech = (require("expo-speech-recognition") as typeof import("expo-speech-recognition")).ExpoSpeechRecognitionModule;
} catch {}

const ready = () => {
  try {
    return Boolean(Speech?.isRecognitionAvailable() && Speech.supportsOnDeviceRecognition());
  } catch {
    return false;
  }
};

/** Mic button for "Say your move". Recognition runs on the device only; audio never leaves it. */
export function SpeakMove({ disabled, onHeard, onNote }: { disabled: boolean; onHeard: (texts: string[]) => void; onNote: (note: string | null) => void }) {
  const [usable, setUsable] = useState(ready);
  const [listening, setListening] = useState(false);
  const cb = useRef({ onHeard, onNote });
  cb.current = { onHeard, onNote };

  useEffect(() => {
    if (!Speech || !usable) return;
    Speech.getPermissionsAsync()
      .then((p) => !p.granted && !p.canAskAgain && setUsable(false))
      .catch(() => setUsable(false));
    const subs = [
      Speech.addListener("result", (e) => e.isFinal && cb.current.onHeard(e.results.map((r) => r.transcript))),
      Speech.addListener("error", (e) => {
        if (e.error === "aborted") return;
        const quiet = e.error === "no-speech" || e.error === "speech-timeout";
        if (!quiet) setUsable(false);
        cb.current.onNote(quiet ? copy.play.voice.unclear("") : copy.play.voice.off);
      }),
      Speech.addListener("end", () => setListening(false)),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      Speech?.abort();
    };
  }, [usable]);

  if (!Speech || !usable) return null;

  const press = async () => {
    if (listening) return Speech!.stop();
    const p = await Speech!.requestPermissionsAsync().catch(() => null);
    if (!p?.granted) {
      setUsable(false);
      return onNote(copy.play.voice.off);
    }
    setListening(true);
    onNote(copy.play.voice.listening);
    try {
      Speech!.start({ lang: language() === "hi" ? "hi-IN" : "en-IN", maxAlternatives: 5, requiresOnDeviceRecognition: true });
    } catch {
      setListening(false);
      setUsable(false);
      onNote(copy.play.voice.off);
    }
  };

  return <Button title="" label={copy.play.voice.listen} icon="mic" variant={listening ? "primary" : "secondary"} block={false} disabled={disabled && !listening} onPress={press} />;
}
