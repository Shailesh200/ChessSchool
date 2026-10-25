import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  StyleSheet: { create: (styles: unknown) => styles },
  Pressable: () => null,
  ScrollView: () => null,
  Text: () => null,
  View: () => null,
  ActivityIndicator: () => null,
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: () => undefined }),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: () => null,
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({ user: null, finishOnboarding: () => undefined }),
}));

vi.mock("@/profile", () => ({
  saveOnboardingToServer: vi.fn(async () => undefined),
}));

vi.mock("@/progressStore", () => ({
  mutateProgress: vi.fn(async (fn: (snap: unknown) => unknown) => fn({})),
}));

vi.mock("@/Button", () => ({ Button: () => null }));
vi.mock("@/haptics", () => ({ haptics: { success: () => undefined } }));
vi.mock("@/Icon", () => ({ Icon: () => null }));
vi.mock("@/flatAvatars/FlatAvatar", () => ({ FlatAvatar: () => null }));
vi.mock("@/iconMaps", () => ({
  AVATAR_OPTIONS: [],
  emojiToIcon: () => "pawn",
}));

import { onboardingCoachChoice } from "../app/onboarding";
import { DEFAULT_COACH_CHARACTER, normalizeCoachCharacter } from "./coachCharacters";
import {
  buildMoveComment,
  type CoachPersonality,
  type MoveCommentKind,
} from "./coaching/botVoice";
import { PERSONAS, personaOf } from "./coaching/personality";
import { hydrateSettings, settings } from "./settings";

const KEY = "chessschool.settings";
const unknown = "not-a-coach" as CoachPersonality;

function memoryStorage(initial?: string) {
  const mem = new Map<string, string>();
  if (initial !== undefined) mem.set(KEY, initial);
  const storage = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
    removeItem: (key: string) => {
      mem.delete(key);
    },
    clear: () => mem.clear(),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

describe("default coach fallbacks", () => {
  it("resolves missing and unknown ids to DEFAULT_COACH_CHARACTER", () => {
    expect(DEFAULT_COACH_CHARACTER).toBe("anxious_nerd");
    expect(normalizeCoachCharacter(undefined)).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("not-a-coach")).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("friendly")).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("strict")).toBe("sarcastic");
    expect(normalizeCoachCharacter("sarcastic")).toBe("sarcastic");
    expect(onboardingCoachChoice("")).toBe(DEFAULT_COACH_CHARACTER);
    expect(onboardingCoachChoice("friendly")).toBe(DEFAULT_COACH_CHARACTER);
    expect(onboardingCoachChoice("sarcastic")).toBe("sarcastic");
    expect(personaOf(unknown)).toBe(PERSONAS[DEFAULT_COACH_CHARACTER]);
    expect(personaOf("sarcastic")).toBe(PERSONAS.sarcastic);
    expect(personaOf("friendly")).toBe(PERSONAS[DEFAULT_COACH_CHARACTER]);
    expect(personaOf("friendly")).not.toBe(PERSONAS.genz);
  });

  it("uses the default coach's move lines when the personality is unknown", () => {
    const ctx = {
      botName: "Cody",
      botElo: 800,
      reactingToPlayer: false,
      moveNumber: 12,
      move: {
        color: "w" as const,
        from: "e2",
        to: "e4",
        piece: "p" as const,
        san: "Qh5#",
        flags: "b",
      },
    };
    const missing = buildMoveComment({ ...ctx, personality: unknown }, "mate");
    expect(missing).toMatch(/Study where shelter broke|The idea started earlier/);
    expect(missing).not.toMatch(/King safety was a choice|hung everything/);

    const missingKind = buildMoveComment(
      { ...ctx, personality: unknown },
      "not-a-kind" as MoveCommentKind,
    );
    expect(missingKind).toMatch(/Trade ahead, improve when equal|plays slowly/);
    expect(missingKind).not.toMatch(/worst piece|Thrilling advice/);

    const saved = buildMoveComment({ ...ctx, personality: "sarcastic" }, "mate");
    expect(saved).toMatch(/King safety was a choice|hung everything/);
  });
});

describe("settings coach default", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", undefined);
    settings.reset();
  });

  it("starts empty settings on the default coach", () => {
    expect(settings.get().coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
    expect(settings.get().coachPersonality).toBe(DEFAULT_COACH_CHARACTER);
    hydrateSettings({});
    expect(settings.get().coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
  });

  it("keeps a saved sarcastic choice from the account and from localStorage", async () => {
    hydrateSettings({ coachCharacter: "sarcastic", coachPersonality: "sarcastic" });
    expect(settings.get().coachCharacter).toBe("sarcastic");
    expect(settings.get().coachPersonality).toBe("sarcastic");

    hydrateSettings({ coachPersonality: "sarcastic" });
    expect(settings.get().coachCharacter).toBe("sarcastic");

    hydrateSettings({ coachCharacter: "friendly" } as never);
    expect(settings.get().coachCharacter).toBe(DEFAULT_COACH_CHARACTER);

    memoryStorage(
      JSON.stringify({ coachCharacter: "sarcastic", coachPersonality: "sarcastic" }),
    );
    vi.resetModules();
    const loaded = await import("./settings");
    expect(loaded.settings.get().coachCharacter).toBe("sarcastic");
    expect(loaded.settings.get().coachPersonality).toBe("sarcastic");

    memoryStorage();
    vi.resetModules();
    const fresh = await import("./settings");
    expect(fresh.settings.get().coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
  });
});
