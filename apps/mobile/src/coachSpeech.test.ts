import { Module } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const speech = vi.hoisted(() => ({
  speak: vi.fn(((_text: string, opts?: { onDone?: () => void }) => {
    opts?.onDone?.();
  }) as (text: string, opts?: { onDone?: () => void }) => void),
  stop: vi.fn(),
}));

const audio = vi.hoisted(() => ({
  createAudioPlayer: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("expo-audio", () => ({
  createAudioPlayer: audio.createAudioPlayer,
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
}));

vi.mock("./api", () => ({
  API_URL: "https://api.test",
  getToken: vi.fn(async () => null),
}));

import { speakCoachText } from "./coachSpeech";

const originalRequire = Module.prototype.require;

describe("speakCoachText", () => {
  beforeEach(() => {
    speech.speak.mockClear();
    speech.stop.mockClear();
    audio.createAudioPlayer.mockClear();
    // coachSpeech loads expo-speech with require(). That package's entry cannot
    // load under Vitest, and this require does not go through vi.mock.
    Module.prototype.require = function (id: string) {
      if (id === "expo-speech") return { speak: speech.speak, stop: speech.stop };
      return originalRequire.call(this, id);
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "tts_unconfigured" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    Module.prototype.require = originalRequire;
    vi.unstubAllGlobals();
  });

  it("falls back to on-device speech when /api/tts returns 503", async () => {
    await speakCoachText("Nice move.");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/api/tts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalledWith(
      "Nice move.",
      expect.objectContaining({ language: "en-US" }),
    );
  });
});
