import type { CoachPersonality } from "@/core/store/settings.store";

export type CoachContext = "lesson" | "success" | "wrong" | "quiz" | "greeting" | "match";

interface Persona {
  praise: string[];
  nudge: string[];
  capture: (p: string) => string;
  check: string;
  mate: string;
  lessonOpeners: string[];
}

export const PERSONAS: Record<CoachPersonality, Persona> = {
  friendly: {
    praise: [
      "Great instinct!",
      "You're getting sharper.",
      "Nice — keep it up!",
      "That's the idea!",
      "Ooh, I like that.",
      "Solid move!",
      "You're in the zone.",
      "Smart choice.",
      "Look at you go!",
      "That's improving!",
      "Confident play.",
      "Good eye!",
    ],
    nudge: [
      "Hmm, is your king safe?",
      "Any pieces hanging?",
      "Can you make a threat?",
      "What's your opponent planning?",
      "Where's your worst piece?",
      "Take your time here.",
      "Could you develop something?",
      "Any checks worth a look?",
    ],
    capture: (p) => `Captured a ${p}! Lovely.`,
    check: "Check! Keep the king on the run.",
    mate: "Checkmate — brilliant finish!",
    lessonOpeners: ["Let's look at this together. ", "Okay — ", ""],
  },
  strict: {
    praise: [
      "Acceptable.",
      "Correct. Continue.",
      "As expected.",
      "Good. Don't relax.",
      "Precise.",
      "That holds.",
      "Disciplined.",
      "Maintain that standard.",
      "Adequate. Push on.",
      "No errors. Good.",
      "Sound.",
      "Continue calculating.",
    ],
    nudge: [
      "Calculate before you move.",
      "Check every threat first.",
      "Is that truly best?",
      "Account for the reply.",
      "Loose pieces lose games.",
      "Verify your king's safety.",
      "Do not drift. Have a plan.",
      "Tempo matters — don't waste it.",
    ],
    capture: (p) => `You won a ${p}. Now convert it.`,
    check: "Check. Do not lose the initiative.",
    mate: "Checkmate. Textbook.",
    lessonOpeners: ["Focus. ", "Calculate. ", ""],
  },
  mentor: {
    praise: [
      "Well reasoned.",
      "You're building good habits.",
      "I like your plan.",
      "Steady progress.",
      "That shows understanding.",
      "Patient and sound.",
      "Good structure.",
      "Thoughtful.",
      "You're seeing more each game.",
      "Nicely judged.",
      "Principled play.",
      "That'll pay off.",
    ],
    nudge: [
      "What does your opponent want?",
      "Look one move deeper.",
      "Improve your worst piece.",
      "Which plan fits this position?",
      "Trade when ahead, complicate when behind.",
      "Where do your pieces belong?",
      "Control the centre.",
      "Don't rush — assess first.",
    ],
    capture: (p) => `A ${p} for you — material adds up over a game.`,
    check: "Check — use the tempo wisely.",
    mate: "Checkmate. You saw it through — well done.",
    lessonOpeners: ["Consider this carefully. ", "Today's study: ", ""],
  },
  tactical: {
    praise: [
      "Sharp!",
      "Tactical eye!",
      "Boom.",
      "Pressure!",
      "Aggressive — I like it.",
      "Now you're attacking!",
      "Punchy.",
      "Keep swinging!",
      "Calculated and bold.",
      "Initiative is yours.",
      "Relentless.",
      "Strike!",
    ],
    nudge: [
      "Any forks or pins?",
      "Look for a tactic!",
      "Can you sacrifice?",
      "Loose piece to grab?",
      "Is the king exposed?",
      "Double attack anywhere?",
      "Can you open lines?",
      "Hunt for a combination.",
    ],
    capture: (p) => `Snagged a ${p}! Keep attacking.`,
    check: "Check! Hunt the king.",
    mate: "CHECKMATE! Devastating.",
    lessonOpeners: ["Hunt the tactic. ", "Attack! ", ""],
  },
  minimal: {
    praise: ["Good.", "OK.", "Fine.", "Yes.", "Mm.", "Right.", "Sure.", "Noted."],
    nudge: ["Think.", "Careful.", "Better square?", "Look again.", "Plan?", "Safe?"],
    capture: (p) => `Won a ${p}.`,
    check: "Check.",
    mate: "Checkmate.",
    lessonOpeners: [""],
  },
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0]!;
}

export function personaOf(p: CoachPersonality): Persona {
  return PERSONAS[p] ?? PERSONAS.friendly;
}

/** Retint bubble copy for the active coach personality. */
export function applyCoachLine(
  raw: string,
  personality: CoachPersonality,
  context: CoachContext,
): string {
  const text = raw.trim();
  if (!text) return text;

  const p = personaOf(personality);

  if (context === "success") {
    if (/^(correct|nice|solved|good|promoted)/i.test(text) && text.length < 48) {
      return pick(p.praise, hash(text));
    }
    const lead = pick(p.praise, hash(text));
    return personality === "minimal" ? lead : `${lead} ${text}`.trim();
  }

  if (context === "wrong") {
    return pick(p.nudge, hash(text + context));
  }

  if (context === "quiz") {
    return personality === "minimal" ? "Choose." : "Pick the best answer.";
  }

  if (context === "match" || context === "greeting") {
    return text;
  }

  if (/Your move\. Find the .* idea\./i.test(text)) {
    const alt = pick(
      [
        "Find the best move in this position.",
        "Calculate the tactic here.",
        "Spot the strongest continuation.",
      ],
      hash(text),
    );
    const opener = pick(p.lessonOpeners, hash(text));
    return opener ? `${opener}${alt}` : alt;
  }

  if (personality === "minimal" && text.length > 100) {
    const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
    return first.length > 120 ? `${first.slice(0, 117)}…` : first;
  }

  const opener = pick(p.lessonOpeners, hash(text));
  return opener ? `${opener}${text}` : text;
}

export function encourage(personality: CoachPersonality, seed: number): string {
  return pick(personaOf(personality).praise, seed);
}

export function nudge(personality: CoachPersonality, seed: number): string {
  return pick(personaOf(personality).nudge, seed);
}
