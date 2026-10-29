import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COACH_TTS_TIMEOUT_MS,
  previewCoachCharacter,
  previewCoachVoice,
  speakCoachText,
  stopCoachSpeech,
} from "./coachSpeech";
import { coachCharacterOf } from "@/features/coaching/characters";
import { useSettings } from "@/core/store/settings.store";

/** #39 defines this on navigator. Drop it so later suites are not stuck pre-gesture. */
function resetUserActivation() {
  Reflect.deleteProperty(navigator, "userActivation");
}

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
    resetUserActivation();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetUserActivation();
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

class FakeAudio {
  static created: string[] = [];
  static plays = 0;
  volume = 1;
  currentTime = 0;
  src: string;
  private listeners = new Map<string, Set<() => void>>();

  constructor(url: string) {
    this.src = url;
    FakeAudio.created.push(url);
  }

  addEventListener(type: string, fn: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }

  pause() {}

  play() {
    FakeAudio.plays += 1;
    this.listeners.get("ended")?.forEach((fn) => fn());
    return Promise.resolve();
  }
}

const speak = vi.fn((utter: SpeechSynthesisUtterance) => {
  utter.onend?.(new Event("end") as SpeechSynthesisEvent);
});

class FakeUtterance {
  text: string;
  volume = 1;
  rate = 1;
  onend: ((ev: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((ev: SpeechSynthesisEvent) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function installBrowserSpeech() {
  speak.mockClear();
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
  );
  vi.stubGlobal("speechSynthesis", {
    speak,
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    pending: false,
    speaking: false,
    paused: false,
    onvoiceschanged: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as SpeechSynthesis);
  vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
}

function installObjectUrls() {
  const url = URL as unknown as {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (objectUrl: string) => void;
  };
  if (typeof url.createObjectURL !== "function") {
    url.createObjectURL = () => "blob:coach-audio";
  }
  if (typeof url.revokeObjectURL !== "function") {
    url.revokeObjectURL = () => {};
  }
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function audioResponse(): Response {
  return new Response(new Uint8Array([0xff, 0xfb]), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}

function errorResponse(): Response {
  return Response.json({ error: "synthesis_failed" }, { status: 502 });
}

/** Fetch that never settles until the playback signal aborts. */
function hangUntilAbort(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const signal = init?.signal;
  if (!signal) return Promise.reject(new Error("missing playback signal"));
  if (signal.aborted) return Promise.reject(signal.reason ?? abortError());
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason ?? abortError()), {
      once: true,
    });
  });
}

function usePlaybackTimers() {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
}

async function timeoutSignal(): Promise<AbortSignal> {
  const timeout = AbortSignal.timeout(1);
  if (timeout.aborted) return timeout;
  await new Promise<void>((resolve) => {
    timeout.addEventListener("abort", () => resolve(), { once: true });
  });
  return timeout;
}

describe("speakCoachText cloud TTS fallback", () => {
  beforeEach(() => {
    resetUserActivation();
    FakeAudio.created = [];
    FakeAudio.plays = 0;
    useSettings.setState({ sound: true, coachSpeech: true, volume: 1 });
    installObjectUrls();
    installBrowserSpeech();
  });

  afterEach(() => {
    stopCoachSpeech();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetUserActivation();
  });

  it("falls back to browser speech when the request is aborted, times out, or the network fails", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockRejectedValueOnce(abortError());
    await speakCoachText("Abort this coach line");
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe("Abort this coach line");
    expect(FakeAudio.plays).toBe(0);

    speak.mockClear();
    const timeout = await timeoutSignal();
    fetchMock.mockRejectedValueOnce(timeout.reason);
    await speakCoachText("Timeout this coach line");
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe("Timeout this coach line");

    speak.mockClear();
    fetchMock.mockRejectedValueOnce(timeout);
    await speakCoachText("Timeout signal coach line");
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe("Timeout signal coach line");

    speak.mockClear();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await speakCoachText("Offline coach line");
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe("Offline coach line");
    expect(FakeAudio.plays).toBe(0);
  });

  it("falls back to browser speech when the server returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Response.json({ error: "synthesis_failed" }, { status: 502 }),
      ),
    );

    await speakCoachText("Server missed this coach line");

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe("Server missed this coach line");
    expect(FakeAudio.plays).toBe(0);
  });

  it("plays the server audio and does not fall back when the request succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        async () =>
          new Response(new Uint8Array([0xff, 0xfb]), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          }),
      ),
    );

    await speakCoachText("Cloud audio coach line");

    expect(FakeAudio.plays).toBe(1);
    expect(FakeAudio.created).toHaveLength(1);
    expect(speak).not.toHaveBeenCalled();
  });

  it("does not fall back when the user stops or skips playback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((_input, init) => {
        const signal = init?.signal;
        if (!signal) return Promise.reject(new Error("missing playback signal"));
        return new Promise((_resolve, reject) => {
          if (signal.aborted) {
            reject(abortError());
            return;
          }
          signal.addEventListener("abort", () => reject(abortError()), { once: true });
        });
      }),
    );

    const pending = speakCoachText("Skip this coach line");
    stopCoachSpeech();
    await pending;

    expect(speak).not.toHaveBeenCalled();
    expect(FakeAudio.plays).toBe(0);
  });

  it("falls back once a fetch that never answers hits the client timeout", async () => {
    usePlaybackTimers();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(hangUntilAbort));

    const pending = speakCoachText("Hang until the client timeout");
    await vi.advanceTimersByTimeAsync(COACH_TTS_TIMEOUT_MS - 1);
    expect(speak).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe("Hang until the client timeout");
    expect(FakeAudio.plays).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stays silent and clears the timer when the user stops before timeout", async () => {
    usePlaybackTimers();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(hangUntilAbort));

    const pending = speakCoachText("Stop before the client timeout");
    expect(vi.getTimerCount()).toBe(1);
    stopCoachSpeech();
    await pending;

    expect(speak).not.toHaveBeenCalled();
    expect(FakeAudio.plays).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays server audio before the timeout and leaves no timer", async () => {
    usePlaybackTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => audioResponse()),
    );

    await speakCoachText("Cloud audio before the timeout");

    expect(FakeAudio.plays).toBe(1);
    expect(speak).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not play an older request that resolves after a newer one starts", async () => {
    let resolveOlder: (response: Response) => void = () => {};
    let resolveNewer: (response: Response) => void = () => {};
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        () =>
          new Promise((resolve) => {
            calls += 1;
            if (calls === 1) resolveOlder = resolve;
            else resolveNewer = resolve;
          }),
      ),
    );

    const older = speakCoachText("Older coach line");
    const newer = speakCoachText("Newer coach line");
    resolveOlder(audioResponse());
    resolveNewer(audioResponse());
    await older;
    await newer;

    expect(speak).not.toHaveBeenCalled();
    expect(FakeAudio.plays).toBe(1);
    expect(FakeAudio.created).toHaveLength(1);
  });
});

const previews = [
  {
    name: "previewCoachVoice",
    line: "Preview the knight fork",
    run: () => previewCoachVoice("emma", "Preview the knight fork"),
  },
  {
    name: "previewCoachCharacter",
    line: coachCharacterOf("anxious_nerd").previewLine,
    run: () => previewCoachCharacter("anxious_nerd"),
  },
] as const;

describe.each(previews)("$name", ({ line, run }) => {
  beforeEach(() => {
    resetUserActivation();
    FakeAudio.created = [];
    FakeAudio.plays = 0;
    speak.mockClear();
    useSettings.setState({ sound: true, coachSpeech: true, volume: 1 });
    installObjectUrls();
    installBrowserSpeech();
  });

  afterEach(() => {
    stopCoachSpeech();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetUserActivation();
  });

  it("falls back to browser speech when the request is aborted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw abortError();
      }),
    );

    await run();

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe(line);
    expect(FakeAudio.plays).toBe(0);
  });

  it("falls back to browser speech when the request times out", async () => {
    usePlaybackTimers();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(hangUntilAbort));

    const pending = run();
    await vi.advanceTimersByTimeAsync(COACH_TTS_TIMEOUT_MS - 1);
    expect(speak).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe(line);
    expect(FakeAudio.plays).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back to browser speech when the server returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => errorResponse()),
    );

    await run();

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].text).toBe(line);
    expect(FakeAudio.plays).toBe(0);
  });

  it("stays silent and clears the timer when the user stops", async () => {
    usePlaybackTimers();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(hangUntilAbort));

    const pending = run();
    expect(vi.getTimerCount()).toBe(1);
    stopCoachSpeech();
    await pending;

    expect(speak).not.toHaveBeenCalled();
    expect(FakeAudio.plays).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
