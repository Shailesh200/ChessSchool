import type { CoachPersonality } from "@/core/store/settings.store";
import type { EndReason } from "@/core/db/db";
import type { VerboseMove } from "@/core/types/chess";
import { applyCoachLine } from "./personality";
import { buildRecapEpilogue } from "./botVoice";
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
      m.captured === "q"
        ? 9
        : m.captured === "r"
          ? 5
          : m.captured === "b" || m.captured === "n"
            ? 3
            : 1;
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
  const { history, personality, botElo, botName, playerColor, playerWon, reason } =
    input;
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
      genz: [
        `Great win vs ${botName}! ${statLine} Replay the mate.`,
        `You beat ${botName}! ${checkLine || statLine}`,
      ],
      sarcastic: [
        `Victory vs ${botName}. ${statLine} Note what forced mate.`,
        `Win. ${checkLine || statLine}`,
      ],
      anxious_nerd: [
        `Well played vs ${botName}. ${statLine} Study the finish.`,
        `You earned this vs ${botName}. ${checkLine || "Calc those lines again."}`,
      ],
      egoistic: [
        `Crushed ${botName}! ${statLine} ${checkLine}`,
        `Attacking win vs ${botName} — ${statLine}`,
      ],
      sassy: [
        `Beat ${botName}. ${statLine}`,
        `Win vs ${botName}. ${checkLine || statLine}`,
      ],
    },
    "checkmate loss": {
      genz: [
        `${botName} got you. ${statLine} Use the review.`,
        `Tough loss to ${botName}. ${checkLine || statLine}`,
      ],
      sarcastic: [
        `Loss to ${botName}. ${statLine} Find the mistake.`,
        `Defeat. ${checkLine || "King safety failed."}`,
      ],
      anxious_nerd: [
        `Loss vs ${botName} — ${statLine} Replay the attack.`,
        `${botName} outcalculated you. ${checkLine || statLine}`,
      ],
      egoistic: [
        `${botName} finished the attack. ${statLine} Hunt the tactic.`,
        `Got mated by ${botName}. ${checkLine || statLine}`,
      ],
      sassy: [
        `${botName} got you. ${statLine}`,
        `Loss to ${botName}. ${checkLine || statLine}`,
      ],
    },
    draw: {
      genz: [
        `Draw with ${botName} — ${statLine}`,
        `Split the point vs ${botName}. ${statLine}`,
      ],
      sarcastic: [`Draw vs ${botName}. ${statLine}`, `Half point. ${statLine}`],
      anxious_nerd: [
        `Draw vs ${botName}. ${statLine} Plan for next time?`,
        `Shared result. ${statLine}`,
      ],
      egoistic: [
        `Hard-fought draw vs ${botName}. ${statLine}`,
        `Stale battle — ${statLine}`,
      ],
      sassy: [
        `Draw vs ${botName}. ${statLine}`,
        `Split vs ${botName}. Could've won. ${statLine}`,
      ],
    },
    "flag win": {
      genz: [
        `You won on time vs ${botName}! ${statLine}`,
        `Clock win — ${statLine}`,
      ],
      sarcastic: [
        `Flag fall — win. ${statLine}`,
        `Won on time. Manage the clock better too.`,
      ],
      anxious_nerd: [
        `Time trouble win vs ${botName}. ${statLine}`,
        `Flag win. ${statLine}`,
      ],
      egoistic: [`${botName} flagged — ${statLine}`, `Speed kill vs ${botName}.`],
      sassy: [
        `Won on time vs ${botName}. ${statLine}`,
        `Flag win — ${statLine}`,
      ],
    },
    "flag loss": {
      genz: [
        `Ran out of time vs ${botName}. ${statLine}`,
        `Clock got you — try longer control.`,
      ],
      sarcastic: [`Lost on time. ${statLine}`, `Flagged. Budget middlegame time.`],
      anxious_nerd: [
        `Time loss vs ${botName}. ${statLine}`,
        `Flag loss. ${statLine}`,
      ],
      egoistic: [`${botName} won on time. ${statLine}`, `Too slow — ${statLine}`],
      sassy: [
        `Ran out of time vs ${botName}. ${statLine}`,
        `Flagged. ${statLine}`,
      ],
    },
    "resign win": {
      genz: [
        `${botName} resigned — ${statLine}`,
        `Win — they resigned. ${statLine}`,
      ],
      sarcastic: [`Resignation win. ${statLine}`, `Point earned. ${statLine}`],
      anxious_nerd: [
        `${botName} resigned. ${statLine} Winning plan.`,
        `Resign win. ${statLine}`,
      ],
      egoistic: [
        `${botName} quit — you had them. ${statLine}`,
        `Resignation. ${statLine}`,
      ],
      sassy: [
        `${botName} resigned. ${statLine}`,
        `Win — they quit. ${statLine}`,
      ],
    },
    "resign loss": {
      genz: [
        `You resigned vs ${botName}. ${statLine}`,
        `Resigned — ${statLine}`,
      ],
      sarcastic: [
        `Resignation. ${statLine}`,
        `You resigned. ${statLine}`,
      ],
      anxious_nerd: [
        `Resigned vs ${botName}. ${statLine}`,
        `Resign loss. ${statLine}`,
      ],
      egoistic: [`You resigned to ${botName}. ${statLine}`, `Resignation. ${statLine}`],
      sassy: [
        `Resigned vs ${botName}. ${statLine}`,
        `Resigned — ${statLine}`,
      ],
    },
  };

  const base = pick(
    pools[outcome]?.[personality] ?? pools.draw.sarcastic ?? pools.draw.anxious_nerd!,
    seed,
  );
  const tail = buildRecapEpilogue(botName, personality, tier, playerWon, seed);
  return applyCoachLine(`${base}${tail}`.trim(), personality, "match");
}
