import type { CoachCharacterId } from "@/features/coaching/characters";
import { normalizeCoachCharacter } from "@/features/coaching/characters";

/** @deprecated Prefer CoachCharacterId */
export type CoachPersonality = CoachCharacterId;

export type CoachContext =
  | "lesson"
  | "success"
  | "wrong"
  | "quiz"
  | "quiz-success"
  | "quiz-wrong"
  | "greeting"
  | "match";

interface Persona {
  praise: string[];
  nudge: string[];
  quizIntro: string[];
  quizSuccess: string[];
  quizRetry: string[];
  quizAnswerLabel: string[];
  capture: (p: string) => string;
  check: string;
  mate: string;
  lessonOpeners: string[];
}

export const PERSONAS: Record<CoachCharacterId, Persona> = {
  anxious_nerd: {
    praise: [
      "Okay okay — that works. You're good.",
      "Yes! I checked twice. That's correct.",
      "Phew. Safe move. Heartbeat normal again.",
      "That holds. I ran it twice. We're fine.",
      "Solid. You saw it before I did.",
      "Correct — king still breathing. Important.",
      "Good instinct. I was worried. You weren't.",
      "Nice. Okay. We can breathe now.",
    ],
    nudge: [
      "Wait — not that square. Breathe.",
      "Oh no. Scan checks first. Try again.",
      "Slow down. Anything hanging? Look again.",
      "That made me twitch. Cleaner idea nearby.",
      "Pause. King safety first. You've got this.",
      "I don't love that. What is their queen doing?",
    ],
    quizIntro: [
      "Pop quiz. No pressure. Little pressure.",
      "Read it twice. Then tap an answer.",
      "Quiz time. I already overthought it.",
    ],
    quizSuccess: [
      "Yes! I knew you'd get it. Mostly.",
      "Correct. I can unclench now.",
      "That's the one. Verified. Moving on.",
    ],
    quizRetry: [
      "Not that — wrong answers are data.",
      "Hmm. Try once more. Read it again.",
      "Close-ish. Slow breath. Another look.",
    ],
    quizAnswerLabel: [
      "Tap the answer you'd double-check",
      "Pick the safest correct option",
      "Which one survives a second look?",
    ],
    capture: (p) => `You took a ${p}. Material up. Nice.`,
    check: "Check! Nice… I checked twice.",
    mate: "Checkmate! I checked. Definitely over.",
    lessonOpeners: [
      "Okay. Stay with me — ",
      "Quick note — ",
      "Careful version — ",
    ],
  },
  genz: {
    praise: [
      "Period. Clean move.",
      "That's the one. Main character energy.",
      "You cooked. Keep cooking.",
      "Clean. Board felt that.",
      "W. Absolute W.",
      "No notes. More of that.",
      "Say less — move said enough.",
      "Lock in. That's how you do it.",
    ],
    nudge: [
      "Nope. Reset. You've got this.",
      "That was mid. Find the real idea.",
      "Not it. Look again — free pieces.",
      "Nah. King safety first. Vibes second.",
      "Try again. Answer's right there.",
      "Miss. Shake it off. Lock back in.",
    ],
    quizIntro: [
      "Pop quiz. No overthinking. Tap truth.",
      "Quick one — which option matches?",
      "Quiz energy. Read once. Choose once.",
    ],
    quizSuccess: [
      "Correct. We love to see it.",
      "That's the one. Big brain.",
      "Yes. Keep that energy.",
    ],
    quizRetry: [
      "Not that. Read it again real quick.",
      "Close but no. Another go.",
      "Miss. Options still there. Lock in.",
    ],
    quizAnswerLabel: [
      "Tap the answer you'd send in chat",
      "Pick the real one",
      "Which option is actually correct?",
    ],
    capture: (p) => `Ate that ${p}. Free food.`,
    check: "Check. They're in the blender.",
    mate: "Checkmate. GG. We move.",
    lessonOpeners: ["Yo. Lock in — ", "Real talk — ", "Listen — "],
  },
  sassy: {
    praise: [
      "Look at you. Finally listening.",
      "There it is, baby. Good taste.",
      "Cute. Correct, even.",
      "That's the move. Took you long enough.",
      "Mm. Competent. I like competent.",
      "Good. Don't make me say it twice.",
      "See? When you listen… magic.",
      "Yes — do that again. Impressed.",
    ],
    nudge: [
      "Cute try. Wrong square, darling.",
      "No, baby. Absolutely not. Look again.",
      "That was bold for wrong reasons.",
      "Honey — no. Find the hanging piece.",
      "Try again — with taste this time.",
      "Embarrassing. Fix it, darling.",
    ],
    quizIntro: [
      "Quiz time, baby. Don't embarrass us.",
      "Read it. Choose wisely. I'm watching.",
      "Pop quiz — not the dramatic answer.",
    ],
    quizSuccess: [
      "Correct. I expect nothing less.",
      "Yes. Keep being right. Suits you.",
      "That's the one. See? Easy.",
    ],
    quizRetry: [
      "Wrong. Adorable, but wrong. Again.",
      "Not that, darling. Read it properly.",
      "Miss. Second chances are a privilege.",
    ],
    quizAnswerLabel: [
      "Tap the answer you'd defend",
      "Pick the correct one, darling",
      "Choose something that won't embarrass you",
    ],
    capture: (p) => `Took their ${p}. Free stuff. Embarrassing.`,
    check: "Check. They're sweating. Good.",
    mate: "Checkmate. Bow. Or don't. We won.",
    lessonOpeners: [
      "Welcome, baby — ",
      "Pay attention, darling — ",
      "Listen carefully — ",
    ],
  },
  sarcastic: {
    praise: [
      "Correct. Don't let it go to your head.",
      "Adequate. I've seen worse before coffee.",
      "That works. Miracles do happen.",
      "Fine. Precision beats flair. You were precise.",
      "Sound. The board approves. Reluctantly.",
      "You calculated instead of hoping. Refreshing.",
      "Good. Try not to look surprised.",
      "Disciplined. Flowers are optional.",
    ],
    nudge: [
      "Bold. Wrong. But bold.",
      "No. Enthusiasm — not much else.",
      "Fascinating choice. Incorrect — but fascinating.",
      "Your king wants better neighbors.",
      "That wasn't illegal. Merely unwise.",
      "Autopilot is for airports. Look again.",
    ],
    quizIntro: [
      "Read twice. Optimism isn't strategy.",
      "One answer is correct. Others flatter you.",
      "Pop quiz. Competence preferred. Poetry optional.",
    ],
    quizSuccess: [
      "Correct. Moving on before overthinking.",
      "As expected. I'd worry if you missed.",
      "Right answer. Try to look less shocked.",
    ],
    quizRetry: [
      "No. Read again — question didn't change.",
      "Wrong. Less guessing. More reading.",
      "Incorrect. Fix it. We'll pretend this never happened.",
    ],
    quizAnswerLabel: [
      "Pick an answer you'd admit in public",
      "Choose one — vaguely on purpose",
      "Tap the least embarrassing option",
    ],
    capture: (p) => `Won a ${p}. Material is material.`,
    check: "Check. They're in trouble. You aren't… yet.",
    mate: "Checkmate. I'll pretend I'm impressed.",
    lessonOpeners: [
      "Bold of you to show up — ",
      "Here's the point — ",
      "I'll keep this short — ",
    ],
  },
  egoistic: {
    praise: [
      "Obviously. That's how winners play.",
      "Correct. I would've played it faster.",
      "Yes. Dominant. Keep that standard.",
      "Strong. Someone who intends to win.",
      "Exactly. Doubt is for other people.",
      "Clean conversion energy. More of that.",
      "Winning chess. Don't apologize for it.",
      "Good. Make the next one look easy.",
    ],
    nudge: [
      "Unacceptable. Take the winning move.",
      "No. Winners don't gift pieces. Look again.",
      "That was soft. Find the forcing idea.",
      "Wrong. Raise your standards.",
      "Not good enough. Calculate like it matters.",
      "They'll punish that. Fix it now.",
    ],
    quizIntro: [
      "Quiz. Answer like you expect to win.",
      "One correct option. Choose it.",
      "Pop quiz — excellence is the baseline.",
    ],
    quizSuccess: [
      "Correct. Obviously.",
      "Yes. Keep stacking wins.",
      "Right. That's the standard.",
    ],
    quizRetry: [
      "Wrong. Again — with standards.",
      "Not that. Winners reread the question.",
      "Miss. Correct it.",
    ],
    quizAnswerLabel: [
      "Pick the winning answer",
      "Choose the strongest option",
      "Tap what a winner would pick",
    ],
    capture: (p) => `Took the ${p}. Free material. Every time.`,
    check: "Check. Pressure them. Don't let up.",
    mate: "Checkmate. Dominate. Next.",
    lessonOpeners: [
      "Obviously you picked right — ",
      "Listen up — ",
      "Winners think like this — ",
    ],
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

export function quizUiLabels(
  personality: CoachCharacterId,
  seed: string,
): { answers: string } {
  const p = personaOf(personality);
  return {
    answers: pick(p.quizAnswerLabel, hash(`${seed}:answers`)),
  };
}

export function personaOf(p: CoachCharacterId | string): Persona {
  const id = normalizeCoachCharacter(p);
  return PERSONAS[id] ?? PERSONAS.sarcastic;
}

const GENERIC_SUCCESS = /^(correct|nice|solved|good|promoted|well done)/i;

const LESSON_TEMPLATE_ALTS: Record<CoachCharacterId, string[]> = {
  anxious_nerd: [
    "Find the safe strong move. I'll wait.",
    "Play the idea that still works if we're wrong.",
    "What would you play if you explained it twice?",
  ],
  genz: [
    "Your move — find the idea that hits.",
    "Lock in. Play the cleanest plan.",
    "What would you play for the clip? That one.",
  ],
  sassy: [
    "Your move. Find something with taste.",
    "Play the idea you'd defend with a smirk.",
    "Find the move that won't embarrass us.",
  ],
  sarcastic: [
    "Find the best move. Not your favorite.",
    "Calculate properly. Board doesn't grade effort.",
    "Play the move you'd defend in public.",
  ],
  egoistic: [
    "Find the move that wins more.",
    "Play the strongest continuation. No soft moves.",
    "Hunt the forcing idea. Winners force.",
  ],
};

export function applyCoachLine(
  raw: string,
  personality: CoachCharacterId | string,
  context: CoachContext,
  seed = "",
): string {
  const text = raw.trim();
  const id = normalizeCoachCharacter(personality);
  const p = personaOf(id);
  const h = hash(seed || text || context);

  if (context === "quiz") {
    return pick(p.quizIntro, h);
  }

  if (context === "quiz-success") {
    return pick(p.quizSuccess, h);
  }

  if (context === "quiz-wrong") {
    const lead = pick(p.quizRetry, h);
    if (text.length > 16) {
      return `${lead} ${text}`;
    }
    return lead;
  }

  if (!text) {
    if (context === "success") return pick(p.praise, h);
    if (context === "wrong") return pick(p.nudge, h);
    return text;
  }

  if (context === "success") {
    const lead = pick(p.praise, h);
    if (GENERIC_SUCCESS.test(text) && text.length < 48) {
      return lead;
    }
    return `${lead} ${text}`;
  }

  if (context === "wrong") {
    const lead = pick(p.nudge, hash(text + context + seed));
    if (text.length > 16) {
      return `${lead} ${text}`;
    }
    return lead;
  }

  if (context === "match" || context === "greeting") {
    return text;
  }

  if (/Your move\. Find the .* idea\./i.test(text)) {
    const alt = pick(LESSON_TEMPLATE_ALTS[id], hash(text + seed));
    const opener = pick(p.lessonOpeners, hash(text + seed));
    return opener ? `${opener}${alt}` : alt;
  }

  const opener = pick(p.lessonOpeners, hash(text + seed));
  return opener ? `${opener}${text}` : text;
}

export function encourage(personality: CoachCharacterId | string, seed: number): string {
  return pick(personaOf(personality).praise, seed);
}

export function nudge(personality: CoachCharacterId | string, seed: number): string {
  return pick(personaOf(personality).nudge, seed);
}
