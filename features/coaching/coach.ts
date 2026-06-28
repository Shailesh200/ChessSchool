import { ChessEngine } from "@/features/chess-engine/engine";
import { chooseMove, eloToConfig } from "@/features/chess-engine/bot";
import { useSettings, type CoachPersonality } from "@/core/store/settings.store";
import type { BoardArrow, VerboseMove } from "@/core/types/chess";

/**
 * Coach voice — five personalities (#25) that retint feedback tone. Pure module;
 * reads the current personality from the settings store at call time.
 */

interface Persona {
  praise: string[];
  nudge: string[];
  capture: (p: string) => string;
  check: string;
  mate: string;
}

const PERSONAS: Record<CoachPersonality, Persona> = {
  friendly: {
    praise: ["Great instinct!", "You're getting sharper.", "Nice — keep it up!", "That's the idea!"],
    nudge: ["Hmm, is your king safe?", "Any pieces hanging?", "Can you make a threat?"],
    capture: (p) => `Captured a ${p}! Lovely.`,
    check: "Check! Keep the king on the run.",
    mate: "Checkmate — brilliant finish! 👑",
  },
  strict: {
    praise: ["Acceptable.", "Correct. Continue.", "As expected.", "Good. Don't relax."],
    nudge: ["Calculate before you move.", "Check every threat first.", "Is that truly best?"],
    capture: (p) => `You won a ${p}. Now convert it.`,
    check: "Check. Do not lose the initiative.",
    mate: "Checkmate. Textbook. 👑",
  },
  mentor: {
    praise: ["Well reasoned.", "You're building good habits.", "I like your plan.", "Steady progress."],
    nudge: ["What does your opponent want?", "Look one move deeper.", "Improve your worst piece."],
    capture: (p) => `A ${p} for you — material adds up over a game.`,
    check: "Check — use the tempo wisely.",
    mate: "Checkmate. You saw it through — well done. 👑",
  },
  tactical: {
    praise: ["Sharp!", "Tactical eye!", "Boom.", "Pressure!"],
    nudge: ["Any forks or pins?", "Look for a tactic!", "Can you sacrifice?"],
    capture: (p) => `Snagged a ${p}! Keep attacking.`,
    check: "Check! Hunt the king.",
    mate: "CHECKMATE! Devastating. 👑",
  },
  minimal: {
    praise: ["Good.", "OK.", "Fine.", "Yes."],
    nudge: ["Think.", "Careful.", "Better square?"],
    capture: (p) => `Won a ${p}.`,
    check: "Check.",
    mate: "Checkmate.",
  },
};

function persona(): Persona {
  const p = useSettings.getState().coachPersonality;
  return PERSONAS[p] ?? PERSONAS.friendly;
}

function pick(list: string[], seed: number): string {
  return list[Math.abs(Math.floor(seed * 97)) % list.length] ?? list[0]!;
}

export function encourage(seed: number): string {
  return pick(persona().praise, seed);
}

export function nudge(seed: number): string {
  return pick(persona().nudge, seed);
}

export function hintArrow(fen: string, strength = 1600): BoardArrow | null {
  const move = chooseMove(fen, eloToConfig(strength), 0.5);
  if (!move) return null;
  return { startSquare: move.from, endSquare: move.to, color: "#5b5bd6" };
}

export function commentOnMove(before: string, move: VerboseMove, seed: number): string {
  const p = persona();
  const engine = new ChessEngine(before);
  if (move.san.includes("#")) return p.mate;
  if (move.captured) return p.capture(pieceName(move.captured));
  if (move.san.includes("+")) return p.check;
  if (engine.inCheck()) return "Careful — you were in check.";
  return encourage(seed);
}

function pieceName(p: string): string {
  return (
    { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[p] ??
    "piece"
  );
}
