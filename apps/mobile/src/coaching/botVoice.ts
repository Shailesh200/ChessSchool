import type { VerboseMove } from "@chess-school/core";
import type { BotTier } from "./matchCommentary";
import { tierForElo } from "./matchCommentary";

export type CoachPersonality = "genz" | "sarcastic" | "anxious_nerd" | "egoistic" | "sassy";

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
    genz: {
      mate: reacting
        ? [`You mated ${b}! Lowkey iconic finish. W.`, `Checkmate on ${b}! Save that line.`]
        : [
            `${b} got the mate. Run it back.`,
            `Mate from ${b}. Every player eats one.`,
          ],
      check: reacting
        ? [`You checked ${b}! Keep the pressure.`, `Check! ${b} has to scramble.`]
        : [
            `${b} checked you. Breathe. Find the safe square.`,
            `Check from ${b}. Still bites if you shrug.`,
          ],
      capture_queen: reacting
        ? [`You took ${b}'s queen! Vibe shift.`, `Queen grab — ${b} is rethinking everything.`]
        : [
            `${b} snagged your queen. Where did she lose guards?`,
            `${b} won your queen. Loose majors get punished.`,
          ],
      capture_rook: reacting
        ? [`You ate ${b}'s rook. Open files yours.`, `Rook capture! ${b} feels that.`]
        : [
            `${b} took your rook. File discipline matters.`,
            `Your rook falls to ${b}. What was it guarding?`,
          ],
      capture_minor: reacting
        ? [`You picked off ${b}'s ${p}. Keep cooking.`, `Nice — ${b}'s ${p} is gone.`]
        : [
            `${b} captured your ${p}. Scan before grabbing back.`,
            `${b} wins the ${p}. Don't donate another.`,
          ],
      capture_pawn: reacting
        ? [`You took ${b}'s pawn. Little bites add up.`, `Pawn grab! Balance shifts on ${b}.`]
        : [
            `${b} ate that. Main character energy rn.`,
            `${b} ate your pawn. Patch the weakness.`,
          ],
      castle: reacting
        ? [`You castled vs ${b}. King in the house.`, `Castle! ${b} works harder now.`]
        : [
            `${b} castled. Standard safety. Fight starts now.`,
            `${b} tucked the king. Plan the pawns.`,
          ],
      promote: [
        `${b} promoted. Stop the next passed pawn.`,
        `Promotion from ${b}! That ${p} went royal.`,
      ],
      en_passant: [
        `${b} en passant'd you. Annoying but legal.`,
        `En passant from ${b}. Chess is weird.`,
      ],
      develop: reacting
        ? [`You're developing vs ${b}. Pieces before ego.`, `Piece out! Tempo still wins.`]
        : [
            `${b} developed. Mirror the energy.`,
            `${b} gets a piece out. Match it.`,
          ],
      center: reacting
        ? [`You fought for the centre vs ${b}.`, `Central pawn! ${b} can't ignore it.`]
        : [
            `${b} claimed the middle. Contest it.`,
            `${b} stakes the centre. Space matters.`,
          ],
      escape_check: [
        `${b} slipped out of check. Reload or regroup?`,
        `${b} found a king square. Initiative delayed.`,
      ],
      quiet_opening: [
        `Quiet opening vs ${b}. Small ideas still hit.`,
        `Subtle vs ${b}. Settle pieces first.`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Probe loose pieces.`,
        `${b} waits. Find a plan before they do.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. Pawns get loud here.`,
        `${b} in the endgame. Technique time.`,
      ],
    },
    sarcastic: {
      mate: reacting
        ? [`You mated ${b}. Note which square was naked.`, `Checkmate vs ${b}. ${b} isn't immortal.`]
        : [
            `${b} mated you. King safety was a choice.`,
            `They hung nothing. You hung everything. Fascinating.`,
          ],
      check: reacting
        ? [`You checked ${b}. Hope is not a plan.`, `Check. ${b} must defend. Don't waste tempo.`]
        : [
            `${b} checks you. Best square. Move on.`,
            `In check from ${b}. Accuracy beats pride.`,
          ],
      capture_queen: reacting
        ? [`You took ${b}'s queen. About time.`, `Queen from ${b} is yours. Don't give it back.`]
        : [
            `${b} wins your queen. That was loose.`,
            `${b} snagged your queen. Majors need babysitters.`,
          ],
      capture_rook: reacting
        ? [`Rook from ${b} is yours. Convert.`, `You win ${b}'s rook. Files matter.`]
        : [
            `${b} captures your rook. File control isn't decorative.`,
            `Your rook falls to ${b}. What was it guarding?`,
          ],
      capture_minor: reacting
        ? [`You win ${b}'s ${p}. Still theft.`, `${b}'s ${p} is gone. Don't return it.`]
        : [
            `${b} takes your ${p}. Actually calculate the recapture.`,
            `${b} wins your ${p}. Loose pieces lose games.`,
          ],
      capture_pawn: reacting
        ? [`Pawn from ${b} is yours. Make it count.`, `You grabbed ${b}'s pawn. Structural damage.`]
        : [
            `${b} grabs a pawn. Structural damage still hurts.`,
            `${b} ate your pawn. Respect the structure.`,
          ],
      castle: reacting
        ? [`You castled vs ${b}. Acceptable king safety.`, `Castle against ${b}. Revolutionary safety.`]
        : [
            `${b} castled. Predictable and correct. Punish pawns.`,
            `${b} tucked the king. Boring. Effective.`,
          ],
      promote: [
        `${b} promoted. Passed pawns don't care about ratings.`,
        `Promotion from ${b}. That ${p} became royalty.`,
      ],
      en_passant: [
        `${b} en passant'd you. Legal, weird, your problem.`,
        `En passant from ${b}. Chess rules are a prank.`,
      ],
      develop: reacting
        ? [`You develop vs ${b}. Pieces before ego.`, `Piece out against ${b}. Still a thing.`]
        : [
            `${b} developed. Mirror or fall behind.`,
            `${b} gets a piece out. Find yours.`,
          ],
      center: reacting
        ? [`You fought for the centre vs ${b}.`, `Central pawn. ${b} noticed. Pretend they didn't.`]
        : [
            `${b} claimed central space. Contest it.`,
            `${b} stakes the middle. Space matters.`,
          ],
      escape_check: [
        `${b} slipped out of check. Attack took a break.`,
        `${b} found a king square. Initiative delayed.`,
      ],
      quiet_opening: [
        `Quiet vs ${b}. Silence isn't safety.`,
        `${b} waits. Hope is not a plan.`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Improve your worst piece.`,
        `No fireworks yet. Thrilling advice.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. One slip and they're smug.`,
        `Technique against ${b}. Kings forward.`,
      ],
    },
    anxious_nerd: {
      mate: reacting
        ? [`You mated ${b}! Replay the forcing moves.`, `Checkmate vs ${b}! I checked twice.`]
        : [
            `${b} mated you. Study where shelter broke.`,
            `Mate from ${b}. The idea started earlier.`,
          ],
      check: reacting
        ? [`You checked ${b}. Good tempo. What's their defense?`, `Check vs ${b}. Improve, don't just poke.`]
        : [
            `${b} checks you. Which escape keeps options?`,
            `In check from ${b}. Calm squares beat fast.`,
          ],
      capture_queen: reacting
        ? [`You won ${b}'s queen! Walk through the conversion.`, `Queen from ${b} is yours. We're fine. Probably.`]
        : [
            `Oh no — ${b} took your queen. We can fix this.`,
            `Losing the queen to ${b}. Where did she lose guards?`,
          ],
      capture_rook: reacting
        ? [`You took ${b}'s rook! Open files. We're okay.`, `Rook capture vs ${b}. Verify the reply.`]
        : [
            `Oh no they took your rook. We can fix this.`,
            `${b} wins your rook. Deep breath. File discipline.`,
          ],
      capture_minor: reacting
        ? [`You picked off ${b}'s ${p}. I double-checked. Solid.`, `${b}'s ${p} is gone. Keep improving.`]
        : [
            `Oh no — ${b} captured your ${p}. Scan for tactics.`,
            `${b} wins the ${p}. Don't donate another.`,
          ],
      capture_pawn: reacting
        ? [`You took ${b}'s pawn. Little bite. Verified.`, `Pawn from ${b} is yours. Stay with me.`]
        : [
            `Oh no they took something. We can fix this.`,
            `${b} ate your pawn. Structure still matters.`,
          ],
      castle: reacting
        ? [`You castled vs ${b}! I can unclench a little.`, `Castle against ${b}. Kings belong tucked.`]
        : [
            `${b} castled. Plan against pawns, not panic.`,
            `${b} tucked the king. Calculate your development.`,
          ],
      promote: [
        `Oh no — ${b} promoted. Stop the next one.`,
        `Promotion from ${b}! Plan the blockade.`,
      ],
      en_passant: [
        `${b} en passant'd you. Legal — I checked mentally.`,
        `En passant from ${b}. Weird rule, real threat.`,
      ],
      develop: reacting
        ? [`You're developing vs ${b}. Pieces before random pushes.`, `Piece out! Development still wins.`]
        : [
            `${b} developed. Mirror tempo — falling behind scares me.`,
            `${b} gets a piece out. Find yours.`,
          ],
      center: reacting
        ? [`You fought for the centre vs ${b}. Good habit.`, `Central pawn from you. ${b} can't ignore it.`]
        : [
            `${b} claimed the middle. Contest it or regret it.`,
            `${b} stakes the centre. Space matters.`,
          ],
      escape_check: [
        `${b} slipped out of check. Reload or regroup?`,
        `${b} found a king square. Not gone. Breathe.`,
      ],
      quiet_opening: [
        `Quiet opening vs ${b}. Develop with purpose.`,
        `Subtle start. What's your best piece doing?`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Trade ahead, improve when equal.`,
        `${b} plays slowly. Find the hidden weakness.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. Activate your king first.`,
        `Few pieces left. One slip still hurts.`,
      ],
    },
    egoistic: {
      mate: reacting
        ? [`You mated ${b}! Remember that line.`, `CHECKMATE vs ${b}! No counterpunch.`]
        : [
            `${b} finished you with mate. Steal the pattern.`,
            `Mate from ${b}. King doomed long before the mark.`,
          ],
      check: reacting
        ? [`You checked ${b}! Keep that king uncomfortable.`, `Check! Pressure anyway. You're built for this.`]
        : [
            `${b} checks you. Hunt the counterattack.`,
            `They scored. Answer harder.`,
          ],
      capture_queen: reacting
        ? [`Queen hunt successful — ${b}'s king stands alone.`, `You took ${b}'s queen. Finish it.`]
        : [
            `${b} wins your queen. Counterplay or die slowly.`,
            `${b} snagged your queen. Loose pieces lose.`,
          ],
      capture_rook: reacting
        ? [`You took ${b}'s rook. Dominate the file.`, `Rook from ${b} is yours. Convert.`]
        : [
            `They scored. Answer harder.`,
            `Your rook falls to ${b}. File control isn't optional.`,
          ],
      capture_minor: reacting
        ? [`You win ${b}'s ${p}. Stack the pressure.`, `${b}'s ${p} is gone. Keep going.`]
        : [
            `${b} captures your ${p}. Strike back.`,
            `${b} wins the ${p}. Still in this fight.`,
          ],
      capture_pawn: reacting
        ? [`You grabbed ${b}'s pawn. Stack every point.`, `Pawn from ${b} is yours. Take it.`]
        : [
            `They scored. Answer harder.`,
            `Pawn loss to ${b}. Tactics, not hope.`,
          ],
      castle: reacting
        ? [`You castled vs ${b}. King safe — win the middle.`, `Castle! ${b} works harder now.`]
        : [
            `${b} castled. Attack the pawns, not fear.`,
            `${b} tucked the king. Punish something else.`,
          ],
      promote: [
        `${b} promoted. Stop the next one.`,
        `Promotion from ${b}! Your king needs a plan.`,
      ],
      en_passant: [
        `${b} en passant'd you. Answer like a champion.`,
        `En passant from ${b}. Weird move, real threat.`,
      ],
      develop: reacting
        ? [`You develop vs ${b}. Tempo is power.`, `Piece out! Winners develop first.`]
        : [
            `${b} developed. Match or beat their tempo.`,
            `${b} gets a piece out. Lagging loses.`,
          ],
      center: reacting
        ? [`You fought for the centre vs ${b}. Champion chess.`, `Central pawn from you. ${b} can't ignore you.`]
        : [
            `${b} claimed the middle. Contest it.`,
            `${b} stakes the centre. Take some back.`,
          ],
      escape_check: [
        `${b} slipped out of check. Reload the attack.`,
        `${b} found a king square. Hit again.`,
      ],
      quiet_opening: [
        `Quiet vs ${b}. Set the trap.`,
        `Opening maneuver. Every tempo counts.`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Tactics loading behind calm.`,
        `${b} plays calm. Don't blink.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. Technique wins titles.`,
        `Few pieces left. One slip loses.`,
      ],
    },
    sassy: {
      mate: reacting
        ? [`You mated ${b}. Game over. As it should be.`, `Checkmate vs ${b}. Correct. Fine.`]
        : [
            `${b} mated you. Embarrassing. Fix the king.`,
            `Mate from ${b}. Your defense still folded.`,
          ],
      check: reacting
        ? [`You checked ${b}! Make them sweat.`, `Check vs ${b}. Keep that king uncomfortable.`]
        : [
            `${b} checks you. No panic moves, darling.`,
            `In check from ${b}. Calm square. Probably fine.`,
          ],
      capture_queen: reacting
        ? [`You took ${b}'s queen! ${b} got humbled.`, `Queen grab — ${b} donated like a gift shop.`]
        : [
            `They took free stuff. Embarrassing. Fix it.`,
            `${b} wins your queen. Majors need guards.`,
          ],
      capture_rook: reacting
        ? [`You ate ${b}'s rook. Your playground now.`, `Rook from ${b} is yours. Don't give it back.`]
        : [
            `They took free stuff. Embarrassing. Fix it.`,
            `Your rook falls to ${b}. What was it doing?`,
          ],
      capture_minor: reacting
        ? [`You picked off ${b}'s ${p}. Still counts.`, `${b}'s ${p} is gone. Keep pressing.`]
        : [
            `${b} captured your ${p}. Loose piece energy.`,
            `${b} wins the ${p}. Don't donate another.`,
          ],
      capture_pawn: reacting
        ? [`You took ${b}'s pawn. Little bite. Satisfying.`, `Pawn from ${b} is yours. Stack the shade.`]
        : [
            `They took free stuff. Embarrassing. Fix it.`,
            `Pawn loss to ${b}. Patch the hole.`,
          ],
      castle: reacting
        ? [`You castled vs ${b}. King tucked — be annoying.`, `Castle! ${b} works harder now.`]
        : [
            `${b} castled. Boring safety. Attack something else.`,
            `${b} tucked the king. Plan the pawns.`,
          ],
      promote: [
        `${b} promoted. Stop the next passed pawn.`,
        `Promotion from ${b}! That ${p} went royal.`,
      ],
      en_passant: [
        `${b} en passant'd you. Legal, petty, effective.`,
        `En passant from ${b}. Chess is weird. Deal.`,
      ],
      develop: reacting
        ? [`You're developing vs ${b}. Pieces out first.`, `Piece out! Tempo still wins.`]
        : [
            `${b} developed. Match the energy.`,
            `${b} gets a piece out. Don't stall.`,
          ],
      center: reacting
        ? [`You fought for the centre vs ${b}. Bully the middle.`, `Central pawn from you. ${b} can't ignore it.`]
        : [
            `${b} claimed the middle. Contest it.`,
            `${b} stakes the centre. Take some back.`,
          ],
      escape_check: [
        `${b} slipped out of check. Reload or regroup.`,
        `${b} found a king square. Initiative delayed.`,
      ],
      quiet_opening: [
        `Quiet vs ${b}. Small ideas still matter.`,
        `Opening continues. Probe for hangs.`,
      ],
      quiet_middlegame: [
        `Middlegame vs ${b}. Waiting moves hide traps.`,
        `${b} plays calm. Find loose pieces.`,
      ],
      quiet_endgame: [
        `Endgame vs ${b}. Pawns get loud. Be precise.`,
        `Few pieces left. Technique still wins.`,
      ],
    },
  };

  const table = tables[personality] ?? tables.sarcastic;
  const pool =
    table[kind] ??
    tables.sarcastic[kind] ??
    table.quiet_middlegame ??
    tables.sarcastic.quiet_middlegame!;
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
      genz: [
        `Back vs ${botName}. Finish what you started.`,
        `Welcome back — ${botName} waits. Close it out.`,
      ],
      sarcastic: [
        `Resumed vs ${botName}. Board forgot nothing.`,
        `Back against ${botName}. Neither should you.`,
      ],
      anxious_nerd: [
        `Welcome back to ${botName}. Scan before you touch.`,
        `Paused mid-fight with ${botName}. Okay. Plan?`,
      ],
      egoistic: [
        `Back vs ${botName}. Finish it. No mercy.`,
        `Resumed against ${botName}. Pick up the attack.`,
      ],
      sassy: [
        `Resumed vs ${botName}. Don't waste my time.`,
        `Back vs ${botName}. Better moves this time.`,
      ],
    };
    return pick(resume[personality], seed);
  }

  const open: Record<CoachPersonality, string[]> = {
    genz: [
      `Yo. Lock in. ${botName} at ${elo}. Let's cook.`,
      `Vs ${botName} (${elo}). Hype on. Calc when it counts.`,
      `Match vs ${botName}! Rated ${elo}. Play bold.`,
    ],
    sarcastic: [
      `Bold of you to show up. ${botName}, ${elo}. Let's begin.`,
      `${botName} · ${elo}. Take them seriously anyway.`,
      `Vs ${botName} (${elo}). Stay awake. Pawns die bored.`,
    ],
    anxious_nerd: [
      `Okay. Stay with me. ${botName} at ${elo}. Play safe.`,
      `Training vs ${botName} (${elo}). Breathe. One idea.`,
      `I'll coach you through ${botName}. Watch and breathe.`,
    ],
    egoistic: [
      `Obviously you picked right. ${botName}, ${elo}. Play.`,
      `Sharp duel vs ${botName} (${elo}). Hunt tactics.`,
      `${botName} at ${elo}. Loose pieces get punished.`,
    ],
    sassy: [
      `Welcome, baby. Vs ${botName}, ${elo}. Don't hang stuff.`,
      `${botName} · ${elo}. Impress me or don't.`,
      `Vs ${botName}. Try not to bore me.`,
    ],
  };

  const tierExtra: Record<BotTier, string> = {
    novice: `First steps — both miss things.`,
    casual: `Casual band — ideas beat memorized theory.`,
    developing: `Developing — punish hangs, watch traps.`,
    club: `Club level — ${botName} spots loose pieces fast.`,
    expert: `Expert — small slips become lectures.`,
    master: `Master band — ${botName} punishes everything.`,
    elite: `Elite — ${botName} doesn't do friendly inaccuracies.`,
  };

  const base = pick(open[personality], seed);
  return `${base} ${tierExtra[tier]}`.trim();
}

/** Post-game epilogue tail — bot identity + coach personality. */
export function buildRecapEpilogue(
  botName: string,
  personality: CoachPersonality,
  _tier: BotTier,
  playerWon: boolean,
  seed: number,
): string {
  const won: Record<CoachPersonality, string[]> = {
    genz: [
      ` Beating ${botName}? W — save the game.`,
      ` Nice vs ${botName}. Different lessons when they lose.`,
    ],
    sarcastic: [
      ` Victory vs ${botName}. Adequate. Play someone harder.`,
      ` You beat ${botName}. Don't confuse luck with ceiling.`,
    ],
    anxious_nerd: [
      ` Strong result vs ${botName}. Write one move down.`,
      ` Win against ${botName}. Notice what came before tactics.`,
    ],
    egoistic: [
      ` You took down ${botName}! Next rating band.`,
      ` Win vs ${botName}. Champions finish.`,
    ],
    sassy: [
      ` Beat ${botName}. As you should.`,
      ` Win vs ${botName}. Don't get cocky.`,
    ],
  };
  const lost: Record<CoachPersonality, string[]> = {
    genz: [
      ` ${botName} got you. Rematch energy calling.`,
      ` Loss to ${botName}. Replay with curiosity.`,
    ],
    sarcastic: [
      ` ${botName} won. Find which habit they exploited.`,
      ` Defeat vs ${botName}. Review until it's boring.`,
    ],
    anxious_nerd: [
      ` Loss to ${botName}. Study one turning point.`,
      ` ${botName} outplayed you. Deep breath.`,
    ],
    egoistic: [
      ` ${botName} turned it — find the missed tactic.`,
      ` Tough loss to ${botName}. Counterattack harder.`,
    ],
    sassy: [
      ` Lost to ${botName}. Fix it in review.`,
      ` Defeat vs ${botName}. Learn or don't bother.`,
    ],
  };
  return pick(playerWon ? won[personality] : lost[personality], seed);
}

/** Thinking-mode opener — bot + coach + calculation framing. */
export function buildThinkingGreeting(
  elo: number,
  botName: string,
  personality: CoachPersonality,
): string {
  const seed = hash(`think:${botName}:${elo}:${personality}`);
  const pools: Record<CoachPersonality, string[]> = {
    genz: [
      `Thinking duel vs ${botName} (${elo}). Honest calc. Let's cook.`,
      `Calc training with ${botName}. See it before you play.`,
    ],
    sarcastic: [
      `Calculation mode vs ${botName}, ${elo}. Confirm every move.`,
      `Thinking match vs ${botName}. No clock, still standards.`,
    ],
    anxious_nerd: [
      `Slow chess vs ${botName} (${elo}). Picture the line. Breathe.`,
      `Calc training vs ${botName}. Name moves out loud.`,
    ],
    egoistic: [
      `Sharp calc duel vs ${botName} (${elo}). See it to the end.`,
      `Thinking game vs ${botName}. Calculate like a champion.`,
    ],
    sassy: [
      `Think vs ${botName}, ${elo}. Use your brain.`,
      `Calc mode · ${botName}. No autopilot. Impress me.`,
    ],
  };
  return pick(pools[personality], seed);
}

export function passPlayGreeting(personality: CoachPersonality): string {
  const seed = hash(`pass:${personality}`);
  const pools: Record<CoachPersonality, string[]> = {
    genz: [
      "Pass and play — two humans, one board. Have fun.",
      "Two players, one device. Talk through ideas.",
    ],
    sarcastic: [
      "Pass and play. Autopilot gets punished here too.",
      "Face to face. Calculate like someone's watching.",
    ],
    anxious_nerd: [
      "Pass and play — say your plan before you move.",
      "Two-player mode. Ask why after big moves.",
    ],
    egoistic: [
      "Pass and play — sharp eyes win brawls.",
      "Human vs human. Attack with calculation, not hope.",
    ],
    sassy: [
      "Pass and play. Move. Don't embarrass yourselves.",
      "Two players. One board. Entertain me.",
    ],
  };
  return pick(pools[personality], seed);
}
