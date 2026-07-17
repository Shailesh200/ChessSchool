import type { CoachPersonality } from "@/core/store/settings.store";
import type { VerboseMove } from "@/core/types/chess";
import type { BotTier } from "./matchCommentary";
import { tierForElo } from "./matchCommentary";

export type BotCharacterId =
  "pip" | "cody" | "remi" | "sasha" | "vera" | "magnus" | "titan";

export type MoveCommentKind =
  | "mate"
  | "check"
  | "capture_queen"
  | "capture_rook"
  | "capture_minor"
  | "capture_pawn"
  | "castle"
  | "promote"
  | "en_passant"
  | "develop"
  | "center"
  | "escape_check"
  | "quiet_opening"
  | "quiet_middlegame"
  | "quiet_endgame";

interface BotCharacter {
  id: BotCharacterId;
  /** How the coach privately thinks about this opponent */
  coachNote: string;
  /** Flavor word for templates */
  flavor: string;
}

const CHARACTERS: Record<string, BotCharacter> = {
  Pip: {
    id: "pip",
    coachNote: "still learning the rules out loud",
    flavor: "earnest",
  },
  Cody: {
    id: "cody",
    coachNote: "casual and a little lucky",
    flavor: "easygoing",
  },
  Remi: {
    id: "remi",
    coachNote: "knows the basics and hates hanging pieces",
    flavor: "steady",
  },
  Sasha: {
    id: "sasha",
    coachNote: "club-sharp and loves traps",
    flavor: "clever",
  },
  Vera: {
    id: "vera",
    coachNote: "calculates like homework is due",
    flavor: "precise",
  },
  "Magnus Jr.": {
    id: "magnus",
    coachNote: "rarely bluffs and rarely forgives",
    flavor: "cold",
  },
  Titan: {
    id: "titan",
    coachNote: "engine-grade — every slip gets punished",
    flavor: "ruthless",
  },
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length] ?? list[0]!;
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function botCharacter(botName: string): BotCharacter {
  return CHARACTERS[botName] ?? CHARACTERS.Cody!;
}

function pieceLabel(p: string | undefined): string {
  return (
    { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[
      p ?? ""
    ] ?? "piece"
  );
}

type LineCtx = {
  botName: string;
  botElo: number;
  personality: CoachPersonality;
  reactingToPlayer: boolean;
  move: VerboseMove;
  moveNumber: number;
};

function templates(
  personality: CoachPersonality,
  kind: MoveCommentKind,
  reacting: boolean,
): string[] {
  const b = "{botName}";
  const p = "{piece}";
  const tables: Record<CoachPersonality, Partial<Record<MoveCommentKind, string[]>>> = {
    friendly: {
      mate: reacting
        ? [
            `You just mated ${b}! That finish had real style — save the line and show someone.`,
            `Checkmate against ${b}! I don't care that they're ${"{flavor}"} — you still had to find it.`,
          ]
        : [
            `${b} got you with mate. ${b} is ${"{note}"}, but that attack was still well built — let's replay it.`,
            `Mate from ${b}. Ouch — but hey, every strong player has eaten one of these.`,
          ],
      check: reacting
        ? [
            `You checked ${b}! Watch the reply — ${"{note}"} opponents still bite back.`,
            `Check! ${b} has to scramble now. Keep the pressure polite but persistent.`,
          ]
        : [
            `${b} checked you. Breathe, find the safest king square, and don't panic-move.`,
            `Check from ${b} — they're ${"{note}"}, but checks still hurt if you shrug.`,
          ],
      capture_queen: reacting
        ? [
            `You took ${b}'s queen! That's the kind of swing that makes ${b} rethink their life choices.`,
            `Queen grab from you — ${b} (${"{flavor}"}) just felt the room get colder.`,
          ]
        : [
            `${b} snagged your queen. Painful, but instructive — where did she lose her guards?`,
            `${b} won your queen. Even a ${"{flavor}"} opponent can punish a loose major piece.`,
          ],
      capture_rook: reacting
        ? [
            `You won ${b}'s rook — open files are ${b}'s nightmare and your playground.`,
            `Rook capture! ${b} will miss that on the back rank.`,
          ]
        : [
            `${b} took your rook. File discipline matters — even vs ${"{note}"} play.`,
            `Your rook falls to ${b}. Ask what square you wish it still guarded.`,
          ],
      capture_minor: reacting
        ? [
            `You picked off ${b}'s ${p} — small wins stack up, especially against ${"{flavor}"} ${b}.`,
            `Nice — ${b}'s ${p} is gone. Keep improving while they're off balance.`,
          ]
        : [
            `${b} captured your ${p}. Scan for tactics before you grab material back.`,
            `${b} wins the ${p}. Not the end of the world, but don't donate another.`,
          ],
      capture_pawn: reacting
        ? [
            `You took ${b}'s pawn — ${b} is ${"{note}"}, but that still shifts the balance.`,
            `Pawn grab! Little bites add up against ${b}.`,
          ]
        : [
            `${b} ate your pawn. Respect the structure even when ${b} plays ${"{flavor}"} chess.`,
            `Pawn loss to ${b}. Fix the weakness before the next exchange.`,
          ],
      castle: reacting
        ? [
            `You castled against ${b} — good! Kings belong in houses, not parking lots.`,
            `Castle! ${b} will have to work harder now that your king has backup.`,
          ]
        : [
            `${b} castled. Standard safety — now the real argument starts.`,
            `${b} tucked the king away. Plan against the pawns, not the fear.`,
          ],
      promote: [
        `${b} promoted a pawn — passed pawns vs ${"{note}"} ${b} are still passed pawns. Stop the next one.`,
        `Promotion from ${b}! That ${p} became royalty; your king is not amused.`,
      ],
      en_passant: [
        `${b} just en passant'd you — ${b} knows the rulebook. Annoying, but legal.`,
        `En passant from ${b}! File that under "chess is weird" and answer carefully.`,
      ],
      develop: reacting
        ? [
            `You're developing against ${b} — love it. Pieces before ego.`,
            `Piece out vs ${b}! ${b} is ${"{flavor}"}, but development still wins games.`,
          ]
        : [
            `${b} developed a piece. Mirror the energy — don't fall behind in tempo.`,
            `${b} gets a knight or bishop into the game. Find your equivalent.`,
          ],
      center: reacting
        ? [
            `You fought for the centre vs ${b} — that's how adults argue on a chess board.`,
            `Central pawn from you! ${b} can't ignore that forever.`,
          ]
        : [
            `${b} claimed central space. Contest it or regret it five moves later.`,
            `${b} stakes the middle — ${"{note}"} or not, space matters.`,
          ],
      escape_check: [
        `${b} slipped out of check. The attack pauses; decide if you reload or regroup.`,
        `${b} found a king square. Your initiative isn't gone — just delayed.`,
      ],
      quiet_opening: [
        `Quiet move in the opening vs ${b}. ${b} is ${"{note}"} — small ideas still matter.`,
        `Subtle play against ${b}. Settle your pieces before the storm.`,
      ],
      quiet_middlegame: [
        `Middlegame maneuver vs ${b}. Ask what plan beats a ${"{flavor}"} opponent here.`,
        `${b} plays a waiting move — probe for loose pieces before they probe you.`,
      ],
      quiet_endgame: [
        `Endgame precision against ${b}. Pawns get loud when pieces disappear.`,
        `${b} in the endgame — technique time. ${"{note}"} doesn't mean sloppy.`,
      ],
    },
    strict: {
      mate: reacting
        ? [
            `You mated ${b}. Good. Don't gloat — note which square ${b} left undefended.`,
            `Checkmate vs ${b}. Finally — ${b} is ${"{note}"}, not immortal.`,
          ]
        : [
            `${b} mated you. ${b} is ${"{flavor}"}, but your king safety was still embarrassing.`,
            `Mate from ${b}. Review the line until you can explain every check.`,
          ],
      check: reacting
        ? [
            `You checked ${b}. Answer their reply with calculation, not hope.`,
            `Check. ${b} must defend — don't waste the tempo.`,
          ]
        : [
            `${b} checks you. No drama — find the best square and move on.`,
            `In check from ${b}. Accuracy beats pride.`,
          ],
      capture_queen: reacting
        ? [`You took ${b}'s queen. About time — ${b} hangs pieces when distracted.`]
        : [`${b} wins your queen. That was not "unlucky"; it was loose.`],
      capture_rook: reacting
        ? [`Rook from ${b}'s side of the board is now yours. Convert.`]
        : [`${b} captures your rook. File control isn't decorative.`],
      capture_minor: reacting
        ? [`You win ${b}'s ${p}. Don't return it with a worse move.`]
        : [`${b} takes your ${p}. Calculate the recapture properly.`],
      capture_pawn: reacting
        ? [`Pawn from ${b} is yours. Fine — now make the next move count.`]
        : [`${b} grabs a pawn. Structural damage is still damage.`],
      castle: reacting
        ? [`You castled vs ${b}. Acceptable king safety — proceed.`]
        : [`${b} castled. Predictable and correct. Punish the pawns instead.`],
      quiet_opening: [
        `Quiet vs ${b}. Don't confuse silence with safety.`,
        `${b} waits — find a plan that isn't hope.`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Loose pieces lose to ${"{flavor}"} opponents too.`,
        `No fireworks — yet. Improve your worst piece.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. One slip and ${b} will act smug about it.`,
        `Technique against ${b}. Kings forward.`,
      ],
    },
    mentor: {
      mate: reacting
        ? [
            `You delivered mate against ${b} — replay the forcing moves and name each check.`,
            `Checkmate vs ${b}. Notice how the attack restricted squares before the finish.`,
          ]
        : [
            `${b} mated you. Study where your king lost shelter — ${b} is ${"{note}"}, but the pattern is universal.`,
            `Mate from ${b}. Between us, the idea started earlier than the final move.`,
          ],
      check: reacting
        ? [
            `You checked ${b} — good tempo. What is their best defense?`,
            `Check vs ${b}. Use the moment to improve, not just to poke.`,
          ]
        : [
            `${b} checks you. Ask which escape square keeps the most options.`,
            `In check from ${b}. Calm squares beat fast squares.`,
          ],
      capture_queen: reacting
        ? [`Winning ${b}'s queen is material — now teach yourself the conversion plan.`]
        : [`Losing the queen to ${b}. Major pieces need minor-piece backup.`],
      quiet_opening: [
        `Opening against ${b}: develop with purpose — ${b} punishes random pawn pushes.`,
        `Quiet start vs ${b}. What is your best piece doing?`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Trade when ahead; improve when equal.`,
        `${b} plays slowly — find the weakness that isn't obvious.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. Activate your king before ${b} activates theirs.`,
        `Few pieces left against ${b}. Precision is the whole lesson.`,
      ],
    },
    tactical: {
      mate: reacting
        ? [
            `You crushed ${b} with mate! That line would work on stronger bots too — remember it.`,
            `CHECKMATE vs ${b}! Devastating — ${b} never got a counterpunch.`,
          ]
        : [
            `${b} finished you with mate. ${b} is ${"{flavor}"}, but that attack had teeth — steal the pattern.`,
            `Mate from ${b}. The king was a target long before the hash mark.`,
          ],
      check: reacting
        ? [
            `You checked ${b}! Keep the king uncomfortable.`,
            `Check! ${b} is ${"{note}"} — pressure anyway.`,
          ]
        : [
            `${b} checks you. Hunt the counterattack if it's there.`,
            `Check from ${b}. Don't go passive unless you must.`,
          ],
      capture_queen: reacting
        ? [`Queen hunt successful — ${b}'s king is lonely now.`]
        : [`${b} wins your queen. Ouch — find counterplay or die slowly.`],
      quiet_middlegame: [
        `Middlegame vs ${b} — tactics are loading behind the quiet move.`,
        `${b} plays calm; don't blink — combinations hide in calm waters.`,
      ],
    },
    minimal: {
      mate: reacting
        ? [`You mated ${b}. Game over.`, `Mate vs ${b}. Correct.`]
        : [`${b} mated you. Unfortunate.`, `Mate from ${b}.`],
      check: reacting
        ? [`You checked ${b}.`, `Check vs ${b}.`]
        : [`${b} checks you.`, `In check.`],
      capture_pawn: reacting
        ? [`You took ${b}'s pawn.`, `Pawn from ${b} is yours.`]
        : [`${b} took your pawn.`, `Pawn loss.`],
      quiet_opening: [`Quiet vs ${b}.`, `Opening continues.`],
      quiet_middlegame: [`Middlegame vs ${b}.`, `Still playing.`],
      quiet_endgame: [`Endgame vs ${b}.`, `Few pieces.`],
    },
  };

  const pool =
    tables[personality][kind] ??
    tables.friendly[kind] ??
    tables[personality].quiet_middlegame ??
    tables.friendly.quiet_middlegame!;
  return pool;
}

/** Full coach+bot move line — personality tone × named opponent character. */
export function buildMoveComment(ctx: LineCtx, kind: MoveCommentKind): string {
  const char = botCharacter(ctx.botName);
  const seed = hash(
    `${ctx.botName}:${ctx.move.san}:${ctx.moveNumber}:${ctx.reactingToPlayer}:${ctx.personality}:${kind}`,
  );
  const pool = templates(ctx.personality, kind, ctx.reactingToPlayer);
  const piece = pieceLabel(ctx.move.captured ?? ctx.move.promotion);
  const raw = pick(pool, seed);
  return fill(raw, {
    botName: ctx.botName,
    piece,
    flavor: char.flavor,
    note: char.coachNote,
  });
}

/** Opening handshake — coach voice introducing this specific bot opponent. */
export function buildMatchGreeting(
  elo: number,
  botName: string,
  personality: CoachPersonality,
  resumed: boolean,
): string {
  const char = botCharacter(botName);
  const tier = tierForElo(elo);
  const seed = hash(`${resumed}:${botName}:${elo}:${personality}`);

  if (resumed) {
    const resume: Record<CoachPersonality, string[]> = {
      friendly: [
        `Welcome back — your game with ${botName} is waiting right where you left it. No judgment, just chess.`,
        `Good to see you again! ${botName} (${elo}) is still ${char.coachNote}; let's finish this properly.`,
      ],
      strict: [
        `Resumed vs ${botName}. Same position — ${char.flavor} opponents don't get easier because you paused.`,
        `Back against ${botName}. Continue with discipline; the board forgot nothing.`,
      ],
      mentor: [
        `Welcome back to your game with ${botName}. Scan the position before you touch a piece.`,
        `We paused mid-fight with ${botName} (${elo}). What's the plan from here?`,
      ],
      tactical: [
        `Back in the arena vs ${botName} — finish what you started.`,
        `Resumed against ${botName}. The attack can pick up where it left off.`,
      ],
      minimal: [`Resumed vs ${botName}.`, `Continue against ${botName}.`],
    };
    return pick(resume[personality], seed);
  }

  const open: Record<CoachPersonality, string[]> = {
    friendly: [
      `Today's opponent is ${botName} at ${elo} — ${char.coachNote}, but cheerful about it. Have fun and calculate when it counts.`,
      `You're facing ${botName} (${elo}). I'll narrate; ${botName} will try their best. Spoiler: that's part of the charm.`,
      `Match vs ${botName}! They're rated ${elo} and ${char.coachNote}. Play bold, play kind, play smart.`,
    ],
    strict: [
      `Opponent: ${botName}, ${elo}. ${char.coachNote}. I expect you to take them seriously anyway.`,
      `${botName} · ${elo}. A ${char.flavor} bot — mistakes happen on both sides; ensure they're not all yours.`,
      `You're playing ${botName} today (${elo}). Don't underestimate ${char.flavor} opponents — boredom is how pawns die.`,
    ],
    mentor: [
      `Training game vs ${botName} (${elo}). ${botName} is ${char.coachNote} — perfect for practicing real habits, not just tricks.`,
      `I'll coach you through a match with ${botName} at ${elo}. Watch what ${char.flavor} play rewards and what it punishes.`,
      `Between us, ${botName} is ${char.coachNote}. Use this game to test one idea: development, safety, or calculation.`,
    ],
    tactical: [
      `Sharp duel vs ${botName} (${elo})! ${char.flavor} on the surface — still hunt tactics every move.`,
      `${botName} at ${elo}. ${char.coachNote}, but if you leave a piece loose, they'll act like a grandmaster about it.`,
      `Attack training vs ${botName}. Rated ${elo}; dangerous enough if you drift.`,
    ],
    minimal: [
      `Vs ${botName}, ${elo}. ${char.coachNote}. Play.`,
      `${botName} · ${elo}. Try not to bore me.`,
    ],
  };

  const tierExtra: Record<BotTier, string> = {
    novice: `First steps territory — both of you will miss things; that's the point.`,
    casual: `Casual band — ideas matter more than memorized theory.`,
    developing: `Developing strength — punish hangs, but expect the occasional trap back.`,
    club: `Club level — ${botName} will notice loose pieces faster than you expect.`,
    expert: `Expert territory — small slips vs ${botName} become long lectures.`,
    master: `Master band — treat ${botName} like they'll punish everything.`,
    elite: `Elite opponent — ${botName} doesn't do "friendly inaccuracies."`,
  };

  const base = pick(open[personality], seed);
  return `${base} ${tierExtra[tier]}`.trim();
}

/** Post-game epilogue tail — bot identity + coach personality. */
export function buildRecapEpilogue(
  botName: string,
  personality: CoachPersonality,
  tier: BotTier,
  playerWon: boolean,
  seed: number,
): string {
  const char = botCharacter(botName);
  const won: Record<CoachPersonality, string[]> = {
    friendly: [
      ` Beating ${botName} at this level is worth a smile — save the game and show a friend.`,
      ` Nice work against ${botName}; ${char.flavor} opponents teach different lessons when they lose.`,
    ],
    strict: [
      ` Victory vs ${botName}. Adequate — now play someone harder before you get sentimental.`,
      ` You beat ${botName}. Don't confuse ${char.coachNote} play with your ceiling.`,
    ],
    mentor: [
      ` Strong result vs ${botName}. Write down one move you'd play again without hesitation.`,
      ` Win against ${botName} — notice what you did before the tactic appeared.`,
    ],
    tactical: [
      ` You took down ${botName}! Keep that attacking energy for the next rating band.`,
      ` Win vs ${botName} — the finish mattered as much as the opening.`,
    ],
    minimal: [` Beat ${botName}.`, ` Win.`],
  };
  const lost: Record<CoachPersonality, string[]> = {
    friendly: [
      ` ${botName} got you this time — ${char.coachNote}, but the rematch is already calling your name.`,
      ` Loss to ${botName}. Replay with curiosity, not shame.`,
    ],
    strict: [
      ` ${botName} won. Figure out which habit ${char.flavor} play exploited.`,
      ` Defeat vs ${botName}. Review until the mistake feels boring.`,
    ],
    mentor: [
      ` Loss to ${botName}. Study one moment where the plan changed — that's your homework.`,
      ` ${botName} outplayed you today. Between us, the idea started earlier than you felt it.`,
    ],
    tactical: [
      ` ${botName} survived your attack and turned it around — find the missed tactic.`,
      ` Tough loss to ${botName}. Counterattack next time with better calculation.`,
    ],
    minimal: [` Lost to ${botName}.`, ` Defeat.`],
  };
  return pick(playerWon ? won[personality] : lost[personality], seed);
}

/** Thinking-mode opener — bot + coach + calculation framing. */
export function buildThinkingGreeting(
  elo: number,
  botName: string,
  personality: CoachPersonality,
): string {
  const char = botCharacter(botName);
  const seed = hash(`think:${botName}:${elo}:${personality}`);
  const pools: Record<CoachPersonality, string[]> = {
    friendly: [
      `Thinking duel vs ${botName} (${elo}) — no clock, just honest calculation. I'll nudge; ${botName} will wait politely.`,
      `Calculation training with ${botName}. They're ${char.coachNote}; perfect for practicing "see it before you play it."`,
    ],
    strict: [
      `Calculation mode vs ${botName}, ${elo}. Confirm every move. ${char.flavor} bots still punish fantasy.`,
      `Thinking match vs ${botName}. No clock doesn't mean no standards.`,
    ],
    mentor: [
      `Slow chess vs ${botName} (${elo}). Picture the whole line, then confirm — that's the habit we're building.`,
      `Training calc against ${botName}. ${char.coachNote} — use the time to name candidate moves out loud.`,
    ],
    tactical: [
      `Sharp calculation duel vs ${botName} (${elo}). See the tactic to the end, then commit.`,
      `Thinking game vs ${botName}. ${char.flavor} on the label, sharp in the tactics — calculate anyway.`,
    ],
    minimal: [`Think vs ${botName}, ${elo}.`, `Calc mode · ${botName}.`],
  };
  return pick(pools[personality], seed);
}

export function passPlayGreeting(personality: CoachPersonality): string {
  const seed = hash(`pass:${personality}`);
  const pools: Record<CoachPersonality, string[]> = {
    friendly: [
      "Pass and play — two humans, one board, zero bots judging your pawn moves. Have fun out there.",
      "Two players, one device. Explain your ideas to each other between moves — it's secretly good coaching.",
    ],
    strict: [
      "Pass and play. Play seriously; the person across from you will punish autopilot just like a bot would.",
      "Face to face. No takebacks, no excuses — calculate like someone respectable is watching.",
    ],
    mentor: [
      "Pass and play — treat it like a lesson you teach each other. Ask 'why' after interesting moves.",
      "Two-player mode: practice saying your plan out loud before you touch a piece.",
    ],
    tactical: [
      "Pass and play — sharp eyes win brawls. If you see a tactic, say it before you play it.",
      "Human vs human on one board. Attack with calculation, not with hope.",
    ],
    minimal: ["Pass and play. Move.", "Two players. One board."],
  };
  return pick(pools[personality], seed);
}
