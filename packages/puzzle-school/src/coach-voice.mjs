import { STAGE_BANDS } from "./concepts.mjs";

/** School coach voice — encouraging, precise, stage-appropriate. */

const SETUP = {
  mate: [
    "Your turn in tactics class — find the forcing checks that leave the king with no escape.",
    "Class is live: hunt the checkmate. Cut off every square the king could run to.",
    "Graduation drill — deliver checkmate. Start with the most forcing check you can find.",
  ],
  fork: [
    "Spot the fork — one move should sting two targets at once.",
    "Tactics time: find the square where one piece bites king and queen (or rook).",
    "Your puzzle for today — a fork is hiding. Knights love this pattern.",
  ],
  pin: [
    "Find the pin or skewer — freeze a piece that cannot move without losing something bigger.",
    "Class exercise: attack through a piece so it is stuck guarding a more valuable target.",
    "Look along the line — a pin or skewer wins material if you find the right move.",
  ],
  discovered: [
    "A discovered attack is waiting — move one piece to unleash another.",
    "Find the move that unmasks an attack. Discovered checks are especially brutal.",
    "Tactics lab: one piece steps aside and a bigger threat appears behind it.",
  ],
  sacrifice: [
    "Sometimes school means giving something up to win more — find the sacrifice that opens the king.",
    "Calculate boldly: a short-term gift can force a winning attack.",
    "Combination class — spot the sacrifice that makes the rest of the line work.",
  ],
  trapped: [
    "Win material cleanly — a piece is loose, overloaded, or has nowhere safe to go.",
    "Homework on the board: capture the defender or grab the hanging piece.",
    "Find the tactic that picks up material without letting your opponent escape.",
  ],
  endgame: [
    "Endgame study — precise technique wins here. Activate your pieces and push the advantage.",
    "Class dismissed on the board only when the technique is exact — find the winning endgame move.",
    "Slow and steady: in the endgame, one accurate move often decides the game.",
  ],
  advantage: [
    "You are ahead — convert with a calm, accurate move. No rush, no gifts back.",
    "Winning class: trade pieces (not pawns), improve your worst piece, and snuff out counterplay.",
    "The position is yours to convert — find the quiet move that keeps control.",
  ],
};

const MID = [
  "Good — keep the combination going. What is the next forcing move?",
  "Nice work. Stay on the line — find the follow-up.",
  "Correct so far. The puzzle is not finished yet.",
];

const FINISH = [
  "Close the combination — deliver the final move.",
  "Last step — finish the tactic cleanly.",
  "One more move wraps up this puzzle.",
];

const CAPSTONE = {
  mate: "Capstone match — three checkmate patterns from this unit. Pass with focus!",
  fork: "Capstone match — three forks to graduate this class. One move, two targets each time.",
  pin: "Capstone match — pins and skewers from real games. Read the lines carefully.",
  discovered: "Capstone match — discovered attacks at full speed. Calculate each line to the end.",
  sacrifice: "Capstone match — combinations and sacrifices. Trust your calculation.",
  trapped: "Capstone match — win material three times to earn your class credit.",
  endgame: "Capstone match — endgame precision under pressure. Technique wins.",
  advantage: "Capstone match — convert the advantage three times. Stay clinical.",
};

/** @param {string} conceptId @param {string} stageId */
export function setupCoach(conceptId, stageId) {
  const lines = SETUP[conceptId] ?? SETUP.trapped;
  const stage = STAGE_BANDS.find((s) => s.id === stageId) ?? STAGE_BANDS[0];
  const idx = stage.order % lines.length;
  let text = lines[idx];
  if (stage.order >= 3) {
    text = text.replace("Class is live:", "Graduate seminar:");
    text = text.replace("Tactics time:", "Advanced tactics:");
  }
  if (stage.order === 0) {
    text = text.replace("Graduation drill", "Practice drill");
  }
  return text;
}

export function midCoach() {
  return MID[Math.floor(Math.random() * MID.length)];
}

export function finishCoach() {
  return FINISH[0];
}

/** Deterministic mid coach for stable lesson content. */
export function midCoachAt(stepIndex) {
  return MID[stepIndex % MID.length];
}

/** @param {string} conceptId @param {string} stageId @param {string} conceptLabel */
export function capstoneIntro(conceptId, stageId, conceptLabel) {
  const base = CAPSTONE[conceptId] ?? `Capstone match — prove your ${conceptLabel} skills.`;
  const stage = STAGE_BANDS.find((s) => s.id === stageId);
  if (!stage) return base;
  return `${stage.title} · ${base}`;
}
