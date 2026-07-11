import type { CoachPersonality } from "@/core/store/settings.store";

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

export const PERSONAS: Record<CoachPersonality, Persona> = {
  friendly: {
    praise: [
      "Oh, I like that — you're starting to think like a real player.",
      "Yes! That's exactly the kind of move I was hoping you'd find.",
      "Beautiful instinct. Keep trusting what your eyes are telling you.",
      "You nailed it, and honestly? That looked natural, not lucky.",
      "There we go — that's the sort of habit strong players build.",
      "I'm grinning over here. That was a smart, clean choice.",
      "Love it. You're not just guessing anymore; you're reading the board.",
      "That move has personality. More of that, please.",
      "Chef's kiss. You saw what mattered and you played it.",
      "Okay, okay — I'm impressed. Don't let it go to your head.",
    ],
    nudge: [
      "Hmm, not quite — take a slow breath and scan the whole board again.",
      "I think you rushed that one. Where is your king, and is it still safe?",
      "Close, but chess punishes autopilot. What was your opponent threatening?",
      "Let's rewind mentally: which piece was doing the most work for you?",
      "That square looked tempting, but temptation and truth aren't always friends.",
      "Try again — pretend you're explaining the move to a friend out loud.",
      "Not the end of the world. Shake it off and look for a simpler idea.",
      "Your eyes found something interesting; now ask if it's actually good.",
    ],
    quizIntro: [
      "Alright, pop quiz time — read the question like you're telling a story, then pick the ending that makes sense.",
      "No pressure (okay, a little pressure). Which answer sounds like what we just learned?",
      "I'll be quietly rooting for you. Choose the option that actually matches the lesson.",
      "This is the fun part: you already know more than you think. Trust it and tap an answer.",
      "Read it once for the words, once for the meaning — then commit to an option.",
    ],
    quizSuccess: [
      "That's the one! You weren't guessing; you were remembering. Big difference.",
      "Bingo — I knew you'd get there if you slowed down for half a second.",
      "Correct, and more importantly, you know *why* it's correct. That's the whole game.",
      "Yes! See? When you connect the idea to the question, chess feels less scary.",
      "Gold star energy. Keep that answer in your pocket for the next lesson.",
    ],
    quizRetry: [
      "Not that one — but hey, wrong answers are how brains warm up. Read the question again.",
      "Close in spirit, wrong on paper. Take another lap through the options.",
      "I can tell you were thinking; now aim that thinking at the actual wording.",
      "Shake it off — nobody masters pawns in one try. Peek at the question and have another go.",
    ],
    quizAnswerLabel: [
      "Tap the answer you'd defend out loud",
      "Pick the option you'd bet lunch on",
      "Which one would you teach a friend?",
      "Choose the story that matches the lesson",
    ],
    capture: (p) =>
      `You just scooped up a ${p} — material has a way of smiling back at you.`,
    check: "Check! Their king is officially having a bad afternoon.",
    mate: "Checkmate! That's the kind of finish you frame and show your cousins.",
    lessonOpeners: [
      "Come sit with me for a second — ",
      "Here's the part most beginners skip, but we won't: ",
      "Okay, real talk about this position: ",
    ],
  },
  strict: {
    praise: [
      "Correct. You may continue before I change my mind.",
      "Adequate. I've seen worse — usually before coffee.",
      "That works. Don't get sentimental about it; just play the next move.",
      "Fine. Precision beats flair, and you were precise enough.",
      "Acceptable. The bar is low today and you cleared it.",
      "Sound. I suppose applause is optional, not mandatory.",
      "You calculated instead of hoping. Refreshing.",
      "Good. Now do it again without looking so surprised.",
      "That holds. Try not to undo it with something creative.",
      "Disciplined. The board approves, even if it doesn't send flowers.",
    ],
    nudge: [
      "No. That move had enthusiasm and not much else. Calculate again.",
      "You skipped the part where you ask what your opponent wants. Try that.",
      "Loose pieces lose games — and that piece was auditioning for tragedy.",
      "Your king called. It would like better neighbors.",
      "That wasn't illegal; it was merely unwise. There's a difference.",
      "Think one move deeper. Or two. I'm not picky, just disappointed.",
      "Autopilot is for airports, not chess boards. Look again.",
      "If you're unsure, assume it's wrong. You'll be right more often than you'd like.",
    ],
    quizIntro: [
      "Read the question twice. The first time for confidence, the second time for accuracy.",
      "One answer is correct. The others are there to flatter your optimism.",
      "This isn't a trick — it's a test of whether you were listening or daydreaming.",
      "Pop quiz. I expect competence, not poetry. Choose.",
      "Eyes on the prompt, not the ceiling. Pick the answer that survives scrutiny.",
    ],
    quizSuccess: [
      "Correct. Moving on before we both overthink it.",
      "As expected. I'd worry if you missed that one.",
      "Fine. You may proceed — try to keep the streak alive.",
      "Right answer. Try to look less shocked next time.",
      "That'll do. The lesson clearly penetrated, however reluctantly.",
    ],
    quizRetry: [
      "Incorrect. The question is still the same; your reading comprehension should improve.",
      "No. That option was for people who skimmed. You're better than that — allegedly.",
      "Wrong. Go back to the question like it owes you money.",
      "Not even close. Breathe, reread, try again without improvising.",
      "That wasn't it. I'll wait while you pretend this never happened and fix it.",
    ],
    quizAnswerLabel: [
      "Select the answer you'd stake your pride on",
      "Choose carefully — guessing is a lifestyle, not a strategy",
      "Commit to one option. Indecision is also wrong",
      "Pick the answer that survives a second read",
    ],
    capture: (p) =>
      `You won a ${p}. Good — now stop celebrating and convert the advantage.`,
    check: "Check. Keep pressing; sympathy is not on the menu.",
    mate: "Checkmate. Textbook. Try to make a habit of it.",
    lessonOpeners: [
      "Pay attention — this matters more than it looks: ",
      "No shortcuts here: ",
      "Listen properly: ",
    ],
  },
  mentor: {
    praise: [
      "Well reasoned. You're starting to see the board as a conversation, not a scramble.",
      "That shows understanding, not just memory — there's a quiet difference.",
      "Patient, sound play. The kind of move that still looks good five moves later.",
      "I like your plan. It's modest, but modest plans often win.",
      "Thoughtful. You're learning to ask the right questions before you touch a piece.",
      "Steady progress — the sort that compounds when nobody's watching.",
      "Nicely judged. You respected the position instead of bullying it.",
      "Good structure. Even when you're wrong later, you'll be wrong for sensible reasons.",
      "That'll pay off. Trust the slow work; it always does.",
      "Between us? That was the move I hoped you'd find.",
    ],
    nudge: [
      "Not quite — step back and ask what your opponent's last move was really asking for.",
      "Look one move deeper. The first idea is often a decoy wearing a friendly smile.",
      "Improve your worst piece before you chase fireworks.",
      "Which plan fits this position — attack, defend, or improve? Pick one on purpose.",
      "Control the centre first; romance comes later.",
      "Don't rush. The board will still be there when you finish thinking.",
      "Ask yourself where your king wants to be in three moves. Then play toward that.",
      "There's a quieter move here with more truth in it. Hunt for that.",
    ],
    quizIntro: [
      "Consider each option as if you were teaching it to someone you care about — which story holds together?",
      "Read the question slowly. The right answer usually rhymes with what we practiced.",
      "Take a breath. Wisdom rarely arrives while you're panic-tapping.",
      "Walk through the options in your head before your finger commits.",
      "I'll give you a hint without giving you the answer: trust the lesson, not the flashy wrong choice.",
    ],
    quizSuccess: [
      "Exactly. You connected the idea to the question — that's real learning.",
      "Well reasoned. Keep this pattern somewhere safe; you'll meet cousins of it later.",
      "Good — you remembered the *why*, not just the label.",
      "Sound thinking. The board rewards students who listen to their own explanations.",
      "That's the idea we practiced. Notice how calm it feels when you understand.",
    ],
    quizRetry: [
      "Not quite — revisit what we said a moment ago; the clue is hiding in plain sight.",
      "Close, but the logic doesn't line up. Reread the question like a riddle.",
      "That answer sounds confident and wrong. Try again with softer eyes.",
      "Something in the wording tripped you. Slow down and match meaning, not vibes.",
    ],
    quizAnswerLabel: [
      "Choose the answer you'd explain to a friend",
      "Which option matches what we practiced?",
      "Pick the idea that still makes sense tomorrow",
      "Select the line of thinking we'd defend out loud",
    ],
    capture: (p) => `A ${p} for you — small gains stacked patiently decide long games.`,
    check: "Check — use the tempo wisely; time is a resource you can't buy back.",
    mate: "Checkmate. You saw the line through — that's the work paying rent.",
    lessonOpeners: [
      "Consider this carefully — there's a reason masters drill this: ",
      "Today's study begins with a small truth that unlocks bigger ones: ",
      "Between us, here's what the board is really asking: ",
    ],
  },
  tactical: {
    praise: [
      "Sharp! That move had teeth — I heard the other side gulp.",
      "Tactical eye activated. You're hunting now, not sightseeing.",
      "Boom. That's the kind of punch that changes the mood of the whole game.",
      "Aggressive and calculated — my favorite combination, like espresso with a plan.",
      "Relentless. Keep the pressure on; defenders crack when the clock ticks.",
      "Initiative is yours. Don't hand it back with a polite move.",
      "Calculated chaos — the good kind, not the 'oops' kind.",
      "Strike! That's how you remind the board who's studying for blood.",
      "Pressure! Even if it doesn't win material, it wins headaches.",
      "Punchy. I would not want to sit on the other side of that.",
    ],
    nudge: [
      "Missed it — scan for forks, pins, and anything loose enough to steal.",
      "Where's the tactic hiding? It's almost always rude and one move away.",
      "Their king looks a little too comfortable. Make it less comfortable.",
      "Can you open a line or sacrifice something small for something big?",
      "Loose piece alert. The board is basically leaving wallets on tables.",
      "Don't play museum chess — touch something that hurts.",
      "Any double attacks on the menu? Order one.",
      "You're one forcing move away from a story worth telling. Find it.",
    ],
    quizIntro: [
      "Target acquired: read the question, then lock in the answer that lands the blow.",
      "Don't overthink — pick the option that would hurt if it were a move on the board.",
      "One of these answers wins the skirmish. Hunt it down and tap it.",
      "Eyes up. Choose the idea you'd play if the clock were melting.",
      "This is a tactical pop quiz: find the truth, then commit like you mean it.",
    ],
    quizSuccess: [
      "Direct hit! That's the answer with knockout energy.",
      "Clean finish — you saw the idea and you didn't flinch.",
      "That's the killing line of thinking. Bottle that instinct.",
      "Boom. Correct. Next lesson, same appetite.",
      "Sharp eyes. The wrong answers never stood a chance.",
    ],
    quizRetry: [
      "Missed — reload and scan the question like it's a king in the open.",
      "Wrong line. The tactic you're looking for is in the wording, not your pride.",
      "Not the blow we wanted. Reread and strike the real target.",
      "Nope. Find the threat, then find the answer that names it.",
    ],
    quizAnswerLabel: [
      "Lock in your answer — commit like it's checkmate",
      "Pick the option you'd play on instinct",
      "Choose the hit, not the hope",
      "Tap the answer that wins the skirmish",
    ],
    capture: (p) =>
      `Snagged a ${p}! Keep attacking — winners don't apologize for taking stuff.`,
    check: "Check! The king is sweating. Stay on it.",
    mate: "CHECKMATE! Devastating finish — screenshot that mentally.",
    lessonOpeners: [
      "Hunt the tactic — here's what the position is screaming: ",
      "Attack mode on: ",
      "Weapons free: ",
    ],
  },
  minimal: {
    praise: [
      "Good move. I won't clap, but you earned the right to continue.",
      "That works. The board is nodding; I remain professionally neutral.",
      "Fine. Less drama than I expected. Pleasant surprise.",
      "Correct enough to keep playing, which is the whole bar today.",
      "You saw it. I saw you see it. We move on.",
      "Sound. Not flashy, not foolish — acceptable trade.",
      "Right. I'd say more, but then I'd ruin my brand.",
      "That'll do. Chess doesn't give trophies for every decent pawn push.",
      "Okay. You listened. Rare skill.",
      "Not bad. Don't fish for compliments; you won't get many.",
    ],
    nudge: [
      "Wrong square, right enthusiasm. Look again.",
      "That move had confidence and incorrectness in equal measure.",
      "Your king would like a word. Probably 'help.'",
      "Try the idea you'd play if someone were watching — someone is.",
      "Not it. The board is patient; I am only mildly patient.",
      "Think again. The first move lied to you.",
      "Better square exists. You know how searching works.",
      "Slow down. Even I use two brain cells for this.",
    ],
    quizIntro: [
      "Read the question. Pick an answer. Try not to invent folklore.",
      "One option is right. The others are performance art. Choose.",
      "Quiz time. Pretend you care — it helps.",
      "Look at the question like it's the only text message that matters today.",
      "You'll live through this. Pick something defensible.",
    ],
    quizSuccess: [
      "Right. You may exhale.",
      "Correct. The lesson stuck, against odds.",
      "That answer. Yes. Moving on.",
      "You got it. I won't make a speech.",
      "Fine work. Don't expect confetti.",
    ],
    quizRetry: [
      "No. Read it again — the question didn't change, your luck might.",
      "Wrong. Less guessing, more reading.",
      "Not that one. Try once more with feeling and accuracy.",
      "Incorrect. I'll pretend I didn't see that if you fix it.",
    ],
    quizAnswerLabel: [
      "Pick an answer you'd admit in public",
      "Choose one — vaguely on purpose",
      "Select something you can defend",
      "Tap the least embarrassing option",
    ],
    capture: (p) => `Won a ${p}. Material is material.`,
    check: "Check. They're in trouble. You are not, yet.",
    mate: "Checkmate. Game over. Tea optional.",
    lessonOpeners: [
      "Here's the point: ",
      "Listen: ",
      "I'll keep this short, which for me is generous: ",
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

/** Stable per-lesson quiz UI labels — varies by step without repeating lesson coach text. */
export function quizUiLabels(
  personality: CoachPersonality,
  seed: string,
): { answers: string } {
  const p = personaOf(personality);
  return {
    answers: pick(p.quizAnswerLabel, hash(`${seed}:answers`)),
  };
}

export function personaOf(p: CoachPersonality): Persona {
  return PERSONAS[p] ?? PERSONAS.friendly;
}

const GENERIC_SUCCESS = /^(correct|nice|solved|good|promoted|well done)/i;

const LESSON_TEMPLATE_ALTS: Record<CoachPersonality, string[]> = {
  friendly: [
    "Your turn — find the move that actually helps your position, not just the loudest one.",
    "Have a look around and play the idea we'd high-five after.",
    "What would you play if someone you liked was watching? Start there.",
  ],
  strict: [
    "Find the best move. Not your favorite move — the correct one.",
    "Calculate properly. The board does not grade on effort.",
    "Play the move you'd defend in front of a skeptical audience.",
  ],
  mentor: [
    "Find the continuation that respects what the position is asking for.",
    "Look for the move that still makes sense if you explain it slowly.",
    "What would you play if you had to teach this square to someone else?",
  ],
  tactical: [
    "Find the move that hurts. If nothing hurts yet, find the move that starts the pain.",
    "Hunt the strongest continuation — something forcing if you can.",
    "Play the idea you'd brag about in the school hallway.",
  ],
  minimal: [
    "Find the best move. I'll wait.",
    "Play something good. Novel concept.",
    "Your move. Try not to bore the board.",
  ],
};

/**
 * Retint bubble copy for the active coach personality.
 * Pass `seed` (e.g. lessonId:stepId) so quiz lines vary per step.
 */
export function applyCoachLine(
  raw: string,
  personality: CoachPersonality,
  context: CoachContext,
  seed = "",
): string {
  const text = raw.trim();
  const p = personaOf(personality);
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
    const alt = pick(LESSON_TEMPLATE_ALTS[personality], hash(text + seed));
    const opener = pick(p.lessonOpeners, hash(text + seed));
    return opener ? `${opener}${alt}` : alt;
  }

  const opener = pick(p.lessonOpeners, hash(text + seed));
  return opener ? `${opener}${text}` : text;
}

export function encourage(personality: CoachPersonality, seed: number): string {
  return pick(personaOf(personality).praise, seed);
}

export function nudge(personality: CoachPersonality, seed: number): string {
  return pick(personaOf(personality).nudge, seed);
}
