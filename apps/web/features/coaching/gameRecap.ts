import type { CoachPersonality } from "@/core/store/settings.store";
import type { EndReason } from "@/core/db/db";
import type { VerboseMove } from "@/core/types/chess";
import { applyCoachLine } from "./personality";
import { tierForElo } from "./matchCommentary";

export interface GameRecapInput {
  history: VerboseMove[];
  personality: CoachPersonality;
  botElo: number;
  botName: string;
  playerColor: "w" | "b";
  playerWon: boolean;
  reason: EndReason;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0] ?? "";
}

function summarizeMaterial(history: VerboseMove[], playerColor: "w" | "b") {
  let player = 0;
  let bot = 0;
  for (const m of history) {
    if (!m.captured) continue;
    const val =
      m.captured === "q" ? 9 : m.captured === "r" ? 5 : m.captured === "b" || m.captured === "n" ? 3 : 1;
    if (m.color === playerColor) player += val;
    else bot += val;
  }
  return { player, bot };
}

function countChecks(history: VerboseMove[], color: "w" | "b"): number {
  return history.filter((m) => m.color === color && m.san.includes("+")).length;
}

/** Post-game coach recap — personality + bot tier, from move history. */
export function buildMatchRecap(input: GameRecapInput): string {
  const { history, personality, botElo, botName, playerColor, playerWon, reason } = input;
  const tier = tierForElo(botElo);
  const moves = history.length;
  const mat = summarizeMaterial(history, playerColor);
  const checksByPlayer = countChecks(history, playerColor);
  const checksByBot = countChecks(history, playerColor === "w" ? "b" : "w");
  const seed = hash(`${moves}:${mat.player}:${mat.bot}:${reason}:${personality}`);

  const outcome =
    reason === "checkmate"
      ? playerWon
        ? "checkmate win"
        : "checkmate loss"
      : reason === "timeout"
        ? playerWon
          ? "flag win"
          : "flag loss"
        : reason === "resign"
          ? playerWon
            ? "resign win"
            : "resign loss"
          : "draw";

  const statLine =
    moves < 8
      ? `Short game — ${moves} moves.`
      : mat.player > mat.bot + 2
        ? `You won material (${mat.player} vs ${mat.bot} pawn-points) in ${moves} moves.`
        : mat.bot > mat.player + 2
          ? `${botName} won the material battle over ${moves} moves.`
          : `Balanced fight across ${moves} moves.`;

  const checkLine =
    checksByPlayer > checksByBot + 1
      ? `You created ${checksByPlayer} checks — good aggression.`
      : checksByBot > checksByPlayer + 1
        ? `${botName} checked you ${checksByBot} times — king safety mattered.`
        : checksByPlayer > 0
          ? `Checks on both sides — tense game.`
          : "";

  const pools: Record<string, Record<CoachPersonality, string[]>> = {
    "checkmate win": {
      friendly: [
        `Great win vs ${botName}! ${statLine} Replay the mating attack.`,
        `You beat ${botName}! ${checkLine || statLine}`,
      ],
      strict: [`Victory vs ${botName}. ${statLine} Note what forced mate.`, `Win. ${checkLine || statLine}`],
      mentor: [
        `Well played against ${botName}. ${statLine} Study the final combination.`,
        `You earned this vs ${botName}. ${checkLine || "Calculate those finishing lines again."}`,
      ],
      tactical: [
        `Crushed ${botName}! ${statLine} ${checkLine}`,
        `Attacking win vs ${botName} — ${statLine}`,
      ],
      minimal: [`Beat ${botName}.`, `Win vs ${botName}.`],
    },
    "checkmate loss": {
      friendly: [
        `${botName} got you this time. ${statLine} Use the mate review to learn.`,
        `Tough loss to ${botName}. ${checkLine || statLine}`,
      ],
      strict: [
        `Loss to ${botName}. ${statLine} Find the defensive mistake.`,
        `Defeat. ${checkLine || "King safety failed."}`,
      ],
      mentor: [
        `Loss vs ${botName} — ${statLine} Replay where the attack started.`,
        `${botName} outcalculated you. ${checkLine || statLine}`,
      ],
      tactical: [
        `${botName} finished the attack. ${statLine} Hunt the missed tactic.`,
        `Got mated by ${botName}. ${checkLine || statLine}`,
      ],
      minimal: [`Lost to ${botName}.`, `Defeat.`],
    },
    draw: {
      friendly: [`Draw with ${botName} — ${statLine}`, `Split the point vs ${botName}. ${statLine}`],
      strict: [`Draw vs ${botName}. ${statLine}`, `Half point. ${statLine}`],
      mentor: [`Draw against ${botName}. ${statLine} What plan would you try next time?`, `Shared result. ${statLine}`],
      tactical: [`Hard-fought draw vs ${botName}. ${statLine}`, `Stale battle — ${statLine}`],
      minimal: ["Draw.", `Draw vs ${botName}.`],
    },
    "flag win": {
      friendly: [`You won on time vs ${botName}! ${statLine}`, `Clock win — ${statLine}`],
      strict: [`Flag fall — win. ${statLine}`, `Won on time. Manage the clock better next game too.`],
      mentor: [`Time trouble win vs ${botName}. ${statLine} Practice faster decisions.`, `Flag win. ${statLine}`],
      tactical: [`${botName} flagged — ${statLine}`, `Speed kill vs ${botName}.`],
      minimal: ["Won on time.", "Flag win."],
    },
    "flag loss": {
      friendly: [`Ran out of time vs ${botName}. ${statLine}`, `Clock got you — try a longer control.`],
      strict: [`Lost on time. ${statLine}`, `Flagged. Budget time in the middlegame.`],
      mentor: [`Time loss vs ${botName}. ${statLine} Use increment or longer clocks while learning.`, `Flag loss. ${statLine}`],
      tactical: [`${botName} won on time. ${statLine}`, `Too slow — ${statLine}`],
      minimal: ["Lost on time.", "Flagged."],
    },
    "resign win": {
      friendly: [`${botName} resigned — ${statLine}`, `Win — opponent resigned. ${statLine}`],
      strict: [`Resignation win. ${statLine}`, `Point earned. ${statLine}`],
      mentor: [`${botName} resigned. ${statLine} You had a winning plan.`, `Resign win. ${statLine}`],
      tactical: [`${botName} quit — you had them. ${statLine}`, `Resignation. ${statLine}`],
      minimal: ["Opponent resigned.", "Win."],
    },
    "resign loss": {
      friendly: [`You resigned vs ${botName}. ${statLine} Review if you could fight on.`, `Resigned — ${statLine}`],
      strict: [`Resignation. ${statLine} Only resign when truly lost.`, `You resigned. ${statLine}`],
      mentor: [`Resigned vs ${botName}. ${statLine} Replay the turning point.`, `Resign loss. ${statLine}`],
      tactical: [`You resigned to ${botName}. ${statLine}`, `Resignation. ${statLine}`],
      minimal: ["You resigned.", "Loss."],
    },
  };

  const tierTail: Record<string, string> = {
    novice: playerWon ? " Keep building those basics." : " Pip-level games are for learning — try again.",
    casual: playerWon ? " Solid for this level." : " Review one tactic from this game.",
    developing: playerWon ? " Good calc for this rating band." : " Calculate checks and captures next time.",
    club: playerWon ? " Club-level win — note your best move." : " Club players punish loose pieces — scan the board.",
    expert: playerWon ? " Strong result at expert strength." : " Expert bots demand precise defense.",
    master: playerWon ? " Impressive vs master-level play." : " Small slips cost games at this level.",
    elite: playerWon ? " Elite scalp — save this PGN." : " Titan-tier — every move must be concrete.",
  };

  const base = pick(pools[outcome]?.[personality] ?? pools.draw.friendly, seed);
  const tail = tierTail[tier] ?? "";
  return applyCoachLine(`${base}${tail}`.trim(), personality, "match");
}
