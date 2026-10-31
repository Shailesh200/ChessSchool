import { beforeEach, describe, expect, it } from "vitest";
import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";
import { useSettings } from "@/core/store/settings.store";
import type { VerboseMove } from "@/core/types/chess";
import {
  COACH_CHARACTERS,
  DEFAULT_COACH_CHARACTER,
  normalizeCoachCharacter,
} from "@/features/coaching/characters";
import {
  buildMoveComment,
  coachCommentLines,
  coachCommentPool,
  type MoveCommentKind,
} from "@/features/coaching/botVoice";
import { buildMatchRecap } from "@/features/coaching/gameRecap";
import { PERSONAS, personaById, personaOf } from "@/features/coaching/personality";
import { googleVoiceFor } from "@/lib/tts/google.server";
import { voicePreviewText } from "@/lib/tts/voicePreview";
import { resolveEdgeVoice, TTS_VOICES } from "@/lib/tts/voices";

const unknown = "not-a-coach" as CoachPersonality;
const preview = () => COACH_CHARACTERS[DEFAULT_COACH_CHARACTER].previewLine;

/** Legacy saved ids. friendly resolves to Otto; strict stays sarcastic. */
const LEGACY_SAVED_COACH = {
  friendly: "anxious_nerd",
  strict: "sarcastic",
  mentor: "anxious_nerd",
  tactical: "egoistic",
  minimal: "sassy",
  anxious_nerd: "anxious_nerd",
  genz: "genz",
  sassy: "sassy",
  sarcastic: "sarcastic",
  egoistic: "egoistic",
} as const satisfies Record<string, CoachPersonality>;

function move(san: string, color: "w" | "b" = "w"): VerboseMove {
  return { color, from: "e2", to: "e4", piece: "p", san, flags: "b" };
}

describe("default coach fallbacks", () => {
  beforeEach(() => {
    localStorage.removeItem("chessschool.settings");
    useSettings.getState().reset();
  });

  it("F1 new settings and migration use the default coach", async () => {
    expect(useSettings.persist.getOptions().version).toBe(14);
    expect(useSettings.getState().coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
    expect(useSettings.getState().coachPersonality).toBe(DEFAULT_COACH_CHARACTER);

    const migrate = useSettings.persist.getOptions().migrate!;
    for (const version of [10, 11]) {
      const fresh = (await migrate({}, version)) as {
        coachCharacter: string;
        coachPersonality: string;
      };
      expect(fresh.coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
      expect(fresh.coachPersonality).toBe(DEFAULT_COACH_CHARACTER);
    }

    const friendly = (await migrate({ coachPersonality: "friendly" }, 10)) as {
      coachCharacter: string;
    };
    expect(friendly.coachCharacter).toBe("anxious_nerd");

    const kept = (await migrate(
      { coachCharacter: "sarcastic", coachPersonality: "sarcastic" },
      11,
    )) as { coachCharacter: string; coachPersonality: string };
    expect(kept.coachCharacter).toBe("sarcastic");
    expect(kept.coachPersonality).toBe("sarcastic");

    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { coachCharacter: "sarcastic", coachPersonality: "sarcastic" },
        version: 11,
      }),
    );
    await useSettings.persist.rehydrate();
    expect(useSettings.getState().coachCharacter).toBe("sarcastic");
    expect(useSettings.getState().coachPersonality).toBe("sarcastic");
  });

  it("pins every legacy saved coach id to its previous resolution", async () => {
    const migrate = useSettings.persist.getOptions().migrate!;
    for (const [saved, resolved] of Object.entries(LEGACY_SAVED_COACH)) {
      expect(normalizeCoachCharacter(saved), saved).toBe(resolved);
      expect(personaOf(saved as CoachPersonality), saved).toBe(PERSONAS[resolved]);
      // Zustand passes the stored version. v10 is the payload this store upgrades.
      const migrated = (await migrate(
        { coachCharacter: saved, coachPersonality: saved },
        10,
      )) as { coachCharacter: string; coachPersonality: string };
      expect(migrated.coachCharacter, saved).toBe(resolved);
      expect(migrated.coachPersonality, saved).toBe(resolved);
    }
  });

  it("stored friendly personality rehydrates to Otto", async () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { coachPersonality: "friendly" },
        version: 10,
      }),
    );
    await useSettings.persist.rehydrate();
    expect(useSettings.getState().coachCharacter).toBe("anxious_nerd");
    expect(useSettings.getState().coachPersonality).toBe("anxious_nerd");
  });

  it("bogus coachCharacter with friendly personality resolves to the default coach", async () => {
    const migrate = useSettings.persist.getOptions().migrate!;
    const mixed = (await migrate(
      { coachCharacter: "bogus", coachPersonality: "friendly" },
      10,
    )) as { coachCharacter: string; coachPersonality: string };
    expect(mixed.coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
    expect(mixed.coachPersonality).toBe(DEFAULT_COACH_CHARACTER);
  });

  it("F5 normalizeCoachCharacter uses the default coach", () => {
    expect(normalizeCoachCharacter(undefined)).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("not-a-coach")).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("friendly")).toBe("anxious_nerd");
    expect(normalizeCoachCharacter("strict")).toBe("sarcastic");
    expect(normalizeCoachCharacter("sarcastic")).toBe("sarcastic");
  });

  it("F7 persona lookup uses the default coach", () => {
    expect(personaById("not-a-coach")).toBe(PERSONAS[DEFAULT_COACH_CHARACTER]);
    expect(personaById("not-a-coach")).not.toBe(PERSONAS.sarcastic);
    expect(personaOf(undefined as never)).toBe(PERSONAS[DEFAULT_COACH_CHARACTER]);
    expect(personaOf(unknown)).toBe(PERSONAS[DEFAULT_COACH_CHARACTER]);
    expect(personaOf("friendly")).toBe(PERSONAS.anxious_nerd);
    expect(personaById("sarcastic")).toBe(PERSONAS.sarcastic);
    expect(personaOf("sarcastic")).toBe(PERSONAS.sarcastic);
  });

  it("F8 botVoice table, kind, and quiet_middlegame use the default coach", () => {
    const tables = {
      sarcastic: { mate: ["ash-mate"], quiet_middlegame: ["ash-quiet"] },
      [DEFAULT_COACH_CHARACTER]: {
        mate: ["otto-mate"],
        quiet_middlegame: ["otto-quiet"],
      },
      genz: { quiet_middlegame: ["kira-quiet"] },
      partial: { check: ["partial-check"] },
    };
    expect(coachCommentPool(tables, "not-a-coach", "mate")).toEqual(["otto-mate"]);
    expect(coachCommentPool(tables, "genz", "mate")).toEqual(["otto-mate"]);
    expect(coachCommentPool(tables, "partial", "not-a-kind")).toEqual(["otto-quiet"]);
    expect(coachCommentPool(tables, "sarcastic", "mate")).toEqual(["ash-mate"]);

    const ctx = {
      botName: "Cody",
      botElo: 800,
      reactingToPlayer: false,
      moveNumber: 12,
      move: move("Qh5#"),
    };
    const missing = buildMoveComment({ ...ctx, personality: unknown }, "mate");
    expect(missing).toMatch(/Study where shelter broke|The idea started earlier/);
    expect(missing).not.toMatch(/King safety was a choice|hung everything/);
    const missingKind = buildMoveComment(
      { ...ctx, personality: unknown },
      "not-a-kind" as MoveCommentKind,
    );
    const ottoQuiet = coachCommentLines(
      DEFAULT_COACH_CHARACTER,
      "quiet_middlegame",
    ).map((line) => line.replace(/\{botName\}/g, ctx.botName));
    expect(ottoQuiet).toContain(missingKind);
    expect(missingKind).not.toMatch(/worst piece|Thrilling advice/);
    const saved = buildMoveComment({ ...ctx, personality: "sarcastic" }, "mate");
    expect(saved).toMatch(/King safety was a choice|hung everything/);
  });

  it("F9 gameRecap uses the default coach for that outcome", () => {
    const history = [move("e4"), move("e5", "b"), move("Qh5#")];
    const input = {
      history,
      botElo: 600,
      botName: "Cody",
      playerColor: "w" as const,
      playerWon: true,
      reason: "checkmate" as const,
    };
    const missing = buildMatchRecap({ ...input, personality: unknown });
    expect(missing).toMatch(/Well played vs Cody|You earned this vs Cody/);
    expect(missing).not.toMatch(/Note what forced mate|Half point|Plan for next time/);
    const saved = buildMatchRecap({ ...input, personality: "sarcastic" });
    expect(saved).toMatch(/Note what forced mate|Adequate|Don't confuse luck/);
    expect(saved).not.toMatch(/Well played vs Cody|You earned this vs Cody/);
  });

  it("F10 voice preview uses the default coach", () => {
    expect(voicePreviewText("auto", unknown)).toBe(preview());
    expect(voicePreviewText("not-a-voice" as CoachVoiceId, unknown)).toBe(preview());
    expect(voicePreviewText("auto", unknown)).not.toBe(
      COACH_CHARACTERS.sarcastic.previewLine,
    );
    expect(voicePreviewText("auto", "sarcastic")).toBe(
      COACH_CHARACTERS.sarcastic.previewLine,
    );
  });

  it("F11 Edge voice uses the default coach", () => {
    const fallback = resolveEdgeVoice("sarcastic", "not-a-voice" as CoachVoiceId);
    expect(fallback.name).toBe(TTS_VOICES[DEFAULT_COACH_CHARACTER].edge.name);
    expect(fallback.name).not.toBe(TTS_VOICES.sarcastic.edge.name);
    expect(resolveEdgeVoice(unknown, "auto").name).toBe(
      TTS_VOICES[DEFAULT_COACH_CHARACTER].edge.name,
    );
    expect(resolveEdgeVoice("sarcastic", "auto").name).toBe(
      TTS_VOICES.sarcastic.edge.name,
    );
  });

  it("F12 Google voice uses the default coach", () => {
    expect(googleVoiceFor(unknown).name).toBe(
      TTS_VOICES[DEFAULT_COACH_CHARACTER].google.name,
    );
    expect(googleVoiceFor(unknown).name).not.toBe(TTS_VOICES.sarcastic.google.name);
    expect(googleVoiceFor("sarcastic").name).toBe(TTS_VOICES.sarcastic.google.name);
  });
});
