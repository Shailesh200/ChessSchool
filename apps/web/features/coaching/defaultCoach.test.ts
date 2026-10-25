import { beforeEach, describe, expect, it } from "vitest";
import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";
import { useSettings } from "@/core/store/settings.store";
import type { VerboseMove } from "@/core/types/chess";
import {
  COACH_CHARACTERS,
  DEFAULT_COACH_CHARACTER,
  normalizeCoachCharacter,
} from "@/features/coaching/characters";
import { buildMoveComment, type MoveCommentKind } from "@/features/coaching/botVoice";
import { buildMatchRecap } from "@/features/coaching/gameRecap";
import { PERSONAS, personaOf } from "@/features/coaching/personality";
import { googleVoiceFor } from "@/lib/tts/google.server";
import { voicePreviewText } from "@/lib/tts/voicePreview";
import { resolveEdgeVoice, TTS_VOICES } from "@/lib/tts/voices";

const unknown = "not-a-coach" as CoachPersonality;

function move(san: string, color: "w" | "b" = "w"): VerboseMove {
  return { color, from: "e2", to: "e4", piece: "p", san, flags: "b" };
}

describe("default coach fallbacks", () => {
  it("resolves missing and unknown ids to DEFAULT_COACH_CHARACTER", () => {
    expect(DEFAULT_COACH_CHARACTER).toBe("anxious_nerd");
    expect(normalizeCoachCharacter(undefined)).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("not-a-coach")).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("friendly")).toBe(DEFAULT_COACH_CHARACTER);
    expect(normalizeCoachCharacter("strict")).toBe("sarcastic");
    expect(normalizeCoachCharacter("sarcastic")).toBe("sarcastic");
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
      move: move("Qh5#"),
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

  it("uses the default coach's pool for that outcome, not the draw pool", () => {
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

  it("uses the default coach voice when the id is unknown", () => {
    const preview = COACH_CHARACTERS[DEFAULT_COACH_CHARACTER].previewLine;
    expect(voicePreviewText("auto", unknown)).toBe(preview);
    expect(voicePreviewText("not-a-voice" as CoachVoiceId, unknown)).toBe(preview);
    expect(voicePreviewText("auto", "sarcastic")).toBe(
      COACH_CHARACTERS.sarcastic.previewLine,
    );

    const edge = resolveEdgeVoice("sarcastic", "not-a-voice" as CoachVoiceId);
    expect(edge.name).toBe(TTS_VOICES[DEFAULT_COACH_CHARACTER].edge.name);
    expect(edge.name).not.toBe(TTS_VOICES.sarcastic.edge.name);
    expect(resolveEdgeVoice(unknown, "auto").name).toBe(
      TTS_VOICES[DEFAULT_COACH_CHARACTER].edge.name,
    );
    expect(resolveEdgeVoice("sarcastic", "auto").name).toBe(
      TTS_VOICES.sarcastic.edge.name,
    );

    expect(googleVoiceFor(unknown).name).toBe(
      TTS_VOICES[DEFAULT_COACH_CHARACTER].google.name,
    );
    expect(googleVoiceFor(unknown).name).not.toBe(TTS_VOICES.sarcastic.google.name);
    expect(googleVoiceFor("sarcastic").name).toBe(TTS_VOICES.sarcastic.google.name);
  });
});

describe("settings coach default", () => {
  beforeEach(() => {
    localStorage.removeItem("chessschool.settings");
    useSettings.getState().reset();
  });

  it("starts new settings on the default coach and keeps a saved sarcastic choice", async () => {
    expect(useSettings.persist.getOptions().version).toBe(11);
    expect(useSettings.getState().coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
    expect(useSettings.getState().coachPersonality).toBe(DEFAULT_COACH_CHARACTER);

    const migrate = useSettings.persist.getOptions().migrate!;
    const fresh = (await migrate({}, 10)) as {
      coachCharacter: string;
      coachPersonality: string;
    };
    expect(fresh.coachCharacter).toBe(DEFAULT_COACH_CHARACTER);
    expect(fresh.coachPersonality).toBe(DEFAULT_COACH_CHARACTER);

    const friendly = (await migrate({ coachPersonality: "friendly" }, 10)) as {
      coachCharacter: string;
    };
    expect(friendly.coachCharacter).toBe(DEFAULT_COACH_CHARACTER);

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
});
