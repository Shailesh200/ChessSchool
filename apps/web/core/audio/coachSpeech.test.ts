import { beforeEach, describe, expect, it, vi } from "vitest";

function stubSpeech(hasBeenActive: boolean) {
  const speak = vi.fn((utter: { onend: (() => void) | null }) => {
    utter.onend?.();
  });
  vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text = "";
      volume = 1;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 502 })),
  );
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { hasBeenActive, isActive: false },
  });
  return speak;
}

async function loadSpeak() {
  vi.resetModules();
  const mod = await import("./coachSpeech");
  return mod.speakCoachText;
}

describe("speakCoachText browser fallback", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call speechSynthesis.speak before a user gesture", async () => {
    const speak = stubSpeech(false);
    const speakCoachText = await loadSpeak();
    await speakCoachText("Push the e-pawn.");
    expect(speak).not.toHaveBeenCalled();
  });

  it("uses speechSynthesis.speak after the visitor has activated the page", async () => {
    const speak = stubSpeech(true);
    const speakCoachText = await loadSpeak();
    await speakCoachText("Push the e-pawn.");
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
