import { ChessEngine } from "@/features/chess-engine/engine";
import type { CoachPersonality } from "@/core/store/settings.store";
import type { VerboseMove } from "@/core/types/chess";
import { applyCoachLine } from "./personality";

export type BotTier =
  | "novice"
  | "casual"
  | "developing"
  | "club"
  | "expert"
  | "master"
  | "elite";

export interface MatchMoveContext {
  beforeFen: string;
  move: VerboseMove;
  botElo: number;
  botName: string;
  personality: CoachPersonality;
  /** Human just moved — bot is reacting. */
  reactingToPlayer: boolean;
  moveNumber: number;
}

type MoveKind =
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
  | "quiet";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0] ?? "";
}

export function tierForElo(elo: number): BotTier {
  if (elo <= 500) return "novice";
  if (elo <= 800) return "casual";
  if (elo <= 1100) return "developing";
  if (elo <= 1500) return "club";
  if (elo <= 1900) return "expert";
  if (elo <= 2300) return "master";
  return "elite";
}

function pieceName(p: string): string {
  return (
    { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[p] ??
    "piece"
  );
}

function classifyMove(beforeFen: string, move: VerboseMove, moveNumber: number): MoveKind {
  if (move.san.includes("#")) return "mate";
  if (move.flags.includes("e")) return "en_passant";
  if (move.promotion) return "promote";
  if (move.flags.includes("k") || move.flags.includes("q")) return "castle";
  if (move.captured === "q") return "capture_queen";
  if (move.captured === "r") return "capture_rook";
  if (move.captured === "n" || move.captured === "b") return "capture_minor";
  if (move.captured === "p") return "capture_pawn";
  if (move.san.includes("+")) return "check";

  const before = new ChessEngine(beforeFen);
  if (before.inCheck()) return "escape_check";

  const backRank = move.color === "w" ? "1" : "8";
  if (
    (move.piece === "n" || move.piece === "b") &&
    move.from[1] === backRank &&
    moveNumber < 16
  ) {
    return "develop";
  }

  const center = new Set(["e4", "d4", "e5", "d5", "c4", "c5", "f4", "f5"]);
  if (move.piece === "p" && center.has(move.to) && moveNumber < 14) return "center";

  return "quiet";
}

function phase(moveNumber: number, fen: string): "opening" | "middlegame" | "endgame" {
  if (moveNumber < 14) return "opening";
  const board = fen.split(" ")[0] ?? "";
  const pieces = board.replace(/[^a-zA-Z]/g, "").length;
  if (pieces <= 12) return "endgame";
  return "middlegame";
}

function tierVoice(tier: BotTier): "simple" | "plain" | "studied" | "sharp" {
  if (tier === "novice" || tier === "casual") return "simple";
  if (tier === "developing" || tier === "club") return "plain";
  if (tier === "expert" || tier === "master") return "studied";
  return "sharp";
}

function quietPools(
  personality: CoachPersonality,
  ph: "opening" | "middlegame" | "endgame",
  voice: ReturnType<typeof tierVoice>,
): string[] {
  if (ph === "endgame") {
    return {
      friendly: ["Endgame time — every pawn counts!", "Fewer pieces, but the tension's still real."],
      strict: ["Endgame — technique decides.", "Activate the king; push passed pawns."],
      mentor: ["Endgame: king forward, pawns matter most.", "Simplify when ahead; complicate when behind."],
      tactical: ["Endgame, but I'm still hunting tricks.", "Sharp even with fewer pieces."],
      minimal: ["Endgame.", "Few pieces left."],
    }[personality];
  }
  if (ph === "middlegame") {
    return {
      friendly: ["The middlegame is where plans matter — what's yours?", "We're in the thick of it now."],
      strict: ["Middlegame — calculate every threat.", "No loose pieces; I'm watching."],
      mentor: ["Middlegame: improve pieces and pick a plan.", "Ask what your opponent wants before moving."],
      tactical: ["I'm lining up threats — can you spot them?", "Middlegame fire — don't blink."],
      minimal: ["Middlegame.", "Continue."],
    }[personality];
  }
  if (voice === "simple") {
    return {
      friendly: ["Hmm, interesting…", "I'm still figuring this out.", "Let's see what happens next."],
      strict: ["Okay. I'll keep thinking.", "No rush — yet."],
      mentor: ["Take your time in the opening.", "Every move should have a reason."],
      tactical: ["I'm setting something up…", "Stay alert — ideas are brewing."],
      minimal: ["…", "Okay."],
    }[personality];
  }
  return {
    friendly: ["Quiet move — the opening is still unfolding.", "Subtle — I'm setting small ideas."],
    strict: ["A waiting move with purpose.", "I improve my worst piece."],
    mentor: ["A flexible move — keeping options open.", "Improving coordination before committing."],
    tactical: ["Preparing a strike — you may not see it yet.", "Quiet before the tactical storm."],
    minimal: ["Noted.", "Continue."],
  }[personality];
}

function pools(
  tier: BotTier,
  personality: CoachPersonality,
  reacting: boolean,
  move: VerboseMove,
): Record<MoveKind, string[]> {
  const voice = tierVoice(tier);
  const your = reacting ? "your" : "my";

  const mateSelf: Record<CoachPersonality, string[]> = {
    friendly: ["Checkmate! What a finish — well played on my side!", "That's mate! Great game."],
    strict: ["Checkmate. The point is decided.", "Mate. Converting was mandatory."],
    mentor: ["Checkmate — the king had no shelter left.", "And that's mate. Notice how the attack built."],
    tactical: ["CHECKMATE! The attack crashes through!", "Mate! Devastating finish."],
    minimal: ["Checkmate.", "Mate."],
  };

  const mateReact: Record<CoachPersonality, string[]> = {
    friendly: ["You got me — beautiful checkmate!", "Wow, you mated me! I'll study that."],
    strict: ["Checkmate against me. Review the attack.", "I was mated. Note where my king went wrong."],
    mentor: ["You delivered mate — replay the forcing line.", "Checkmate. Good calculation from you."],
    tactical: ["You finished me off — sharp play!", "Mate! I missed your final shot."],
    minimal: ["You won.", "Mate."],
  };

  const checkSelf: Record<CoachPersonality, string[]> = {
    friendly: ["Check! Keep an eye on your king.", "Check — your king needs a plan."],
    strict: ["Check. Answer precisely.", "Your king is in check — no slips."],
    mentor: ["Check — use this tempo to improve your pieces.", "Check. What is your king's best escape?"],
    tactical: ["Check! The king is on the run.", "Check — keep the pressure on."],
    minimal: ["Check.", "In check."],
  };

  const checkReact: Record<CoachPersonality, string[]> = {
    friendly: ["You checked me — I'm scrambling!", "Check from you! Let me find a square."],
    strict: ["You gave check. I must defend accurately.", "Check. I won't loosen up here."],
    mentor: ["You checked me — good use of tempo.", "Check against me. Calculate my reply."],
    tactical: ["You checked me — I'll hit back soon.", "Check! Nice — but I'm not done."],
    minimal: ["Check.", "I'm in check."],
  };

  const capture = (piece: string, big: boolean): string[] => {
    if (reacting) {
      if (voice === "simple") {
        return personality === "tactical"
          ? [`Hey, you took my ${piece}!`, `You got my ${piece} — I'll get you back!`]
          : [`You captured my ${piece}.`, `My ${piece} is gone — good for you.`];
      }
      if (voice === "sharp") {
        return [
          `You took my ${piece}. I'll need compensation.`,
          `Losing the ${piece} — I must activate counterplay.`,
        ];
      }
      return [
        `You took my ${piece}${big ? " — that's a big grab" : ""}.`,
        `My ${piece} is off the board after that exchange.`,
      ];
    }
    if (voice === "simple") {
      return [`I took your ${piece}!`, `Got your ${piece} — nice, right?`];
    }
    if (voice === "sharp") {
      return [
        `I won the ${piece} — the position tilts my way.`,
        `Your ${piece} falls; I'm consolidating the advantage.`,
      ];
    }
    return [
      `I captured your ${piece}.`,
      `That ${piece} is mine now — ${your} structure loosens.`,
    ];
  };

  const castleSelf: Record<CoachPersonality, string[]> = {
    friendly: ["Castled! My king feels safer already.", "King tucked away — ready to play."],
    strict: ["Castled. King safety secured.", "King to safety — now the real fight."],
    mentor: ["Castled — classic king safety before the middlegame.", "I castled; notice how the rook joins the game."],
    tactical: ["Castled — but I'm still coming for you.", "King safe, rooks awake — let's go."],
    minimal: ["Castled.", "King safe."],
  };

  const castleReact: Record<CoachPersonality, string[]> = {
    friendly: ["You castled — smart, your king looks cozy!", "Nice castle! I'll need a plan against that."],
    strict: ["You castled. I'll target the remaining weaknesses.", "King safe for you — mine is too."],
    mentor: ["Good — you castled. Connect your rooks next.", "You castled on time; that's principled."],
    tactical: ["You castled, but my attack isn't finished.", "Castle won't stop my initiative."],
    minimal: ["You castled.", "King safe."],
  };

  const developSelf: Record<CoachPersonality, string[]> = {
    friendly: ["Developing a piece — getting into the game!", "Out with the pieces — this feels right."],
    strict: ["Piece developed. Don't fall behind in tempo.", "Development first — standard play."],
    mentor: ["I developed — pieces before pawns in the opening.", "Knight or bishop out; the fight begins."],
    tactical: ["Piece out — hunting for tactics soon.", "Developed and eyeing your king."],
    minimal: ["Developed.", "Piece out."],
  };

  const developReact: Record<CoachPersonality, string[]> = {
    friendly: ["You're developing nicely — I see you!", "Good development from you — I'll catch up."],
    strict: ["You developed. I'll punish slow play if I can.", "Your piece is out — I won't waste time."],
    mentor: ["Solid development — keep improving the worst piece.", "You developed; aim for the centre next."],
    tactical: ["You developed — but I'm building threats.", "Your piece is out; so is mine."],
    minimal: ["You developed.", "Piece out."],
  };

  const centerSelf: Record<CoachPersonality, string[]> = {
    friendly: ["Central pawn — fighting for the middle!", "I like this square in the centre."],
    strict: ["Central pawn. Space matters.", "I claim the centre — contest it if you can."],
    mentor: ["A central pawn — classic opening strategy.", "Fighting for the centre; that's the right idea."],
    tactical: ["Central pawn — opening lines for an attack.", "I stake the centre — your move."],
    minimal: ["Centre.", "Central pawn."],
  };

  const promotePiece = move.promotion ? pieceName(move.promotion) : "queen";
  const promoteSelf: Record<CoachPersonality, string[]> = {
    friendly: [`Promotion! My pawn becomes a ${promotePiece} — exciting!`],
    strict: ["Promotion. Convert the advantage."],
    mentor: ["Promotion — passed pawns must be pushed."],
    tactical: [`Promotion! New ${promotePiece}, new problems for you.`],
    minimal: ["Promoted."],
  };

  const enPassantSelf: Record<CoachPersonality, string[]> = {
    friendly: ["En passant! Did you see that rule coming?"],
    strict: ["En passant — know your pawn rules."],
    mentor: ["En passant — a detail that wins games."],
    tactical: ["En passant — sneaky and strong."],
    minimal: ["En passant."],
  };

  const escapeSelf: Record<CoachPersonality, string[]> = {
    friendly: ["Phew — got my king out of check.", "King safe again… for now."],
    strict: ["King escaped check. Next threat matters more.", "Defended — don't celebrate yet."],
    mentor: ["I escaped check; pick the best square, not just any square.", "King safety restored — reassess the position."],
    tactical: ["Slipped out of check — counterattack loading.", "King moves — but I'm not done attacking."],
    minimal: ["Out of check.", "King moved."],
  };

  return {
    mate: reacting ? mateReact[personality] : mateSelf[personality],
    check: reacting ? checkReact[personality] : checkSelf[personality],
    capture_queen: capture("queen", true),
    capture_rook: capture("rook", true),
    capture_minor: capture(move.captured === "b" ? "bishop" : "knight", false),
    capture_pawn: capture("pawn", false),
    castle: reacting ? castleReact[personality] : castleSelf[personality],
    promote: promoteSelf[personality],
    en_passant: enPassantSelf[personality],
    develop: reacting ? developReact[personality] : developSelf[personality],
    center: centerSelf[personality],
    escape_check: escapeSelf[personality],
    quiet: quietPools(personality, "opening", voice),
  };
}

function messageFor(ctx: MatchMoveContext, kind: MoveKind, seed: number): string {
  const tier = tierForElo(ctx.botElo);
  const table = pools(tier, ctx.personality, ctx.reactingToPlayer, ctx.move);
  let pool = table[kind];

  if (kind === "quiet") {
    const ph = phase(ctx.moveNumber, ctx.beforeFen);
    pool = quietPools(personalityOf(ctx), ph, tierVoice(tier));
  }

  return pick(pool, seed);
}

function personalityOf(ctx: MatchMoveContext): CoachPersonality {
  return ctx.personality;
}

/** Bot line after a match move — bot tier + coach personality, no extra settings. */
export function commentOnMatchMove(ctx: MatchMoveContext): string {
  const kind = classifyMove(ctx.beforeFen, ctx.move, ctx.moveNumber);
  const seed = hash(
    `${ctx.beforeFen}:${ctx.move.san}:${ctx.moveNumber}:${ctx.reactingToPlayer}:${ctx.personality}`,
  );
  const raw = messageFor(ctx, kind, seed);
  return applyCoachLine(raw, ctx.personality, "match");
}

const GREETING_RESUME: Record<CoachPersonality, string[]> = {
  friendly: ["Welcome back! Your game is right where you left off.", "Good to see you — let's finish this game."],
  strict: ["Resumed. Same position — no excuses.", "Back. Continue from here."],
  mentor: ["Welcome back — review the position before you move.", "We paused here; what's the plan now?"],
  tactical: ["Back in the fight — finish them off.", "Resumed — time to strike."],
  minimal: ["Resumed.", "Continue."],
};

function greetingIntro(tier: BotTier, botName: string, elo: number): string[] {
  switch (tier) {
    case "novice":
      return [
        `Hi, I'm ${botName}! I'm still learning too — rated around ${elo}.`,
        `${botName} here. Fair warning: I miss stuff sometimes. Want a gentle game?`,
      ];
    case "casual":
      return [
        `Hey! ${botName} at ${elo}. Let's have a fun game.`,
        `I'm ${botName} — rated ${elo}. Nothing too serious, just chess.`,
      ];
    case "developing":
      return [
        `${botName}, ${elo}. I know openings and tactics — bring your A-game.`,
        `Hi — ${botName}, rated ${elo}. I'll punish loose pieces if I see them.`,
      ];
    case "club":
      return [
        `${botName} · ${elo}. Club habits: develop fast, fight for the centre.`,
        `I'm ${botName} at ${elo} — expect solid play and the occasional trap.`,
      ];
    case "expert":
      return [
        `${botName}, ${elo}. I'll test your calculation in the middlegame.`,
        `Expert ${botName} — rated ${elo}. Small inaccuracies add up.`,
      ];
    case "master":
      return [
        `${botName} · ${elo}. I rarely miss tactical shots — stay sharp.`,
        `Master-strength ${botName} at ${elo}. Precision matters from move one.`,
      ];
    case "elite":
      return [
        `${botName}. Rated ${elo}. I'll push you on every critical square.`,
        `${botName} — ${elo}. Bring your best endgame technique too.`,
      ];
  }
}

export function matchGreeting(
  elo: number,
  botName: string,
  resumed: boolean,
  personality: CoachPersonality,
): string {
  if (resumed) {
    const seed = hash(`resume:${botName}:${personality}`);
    return applyCoachLine(pick(GREETING_RESUME[personality], seed), personality, "greeting");
  }
  const tier = tierForElo(elo);
  const seed = hash(`hello:${botName}:${elo}:${personality}`);
  const intro = pick(greetingIntro(tier, botName, elo), seed);
  return applyCoachLine(intro, personality, "greeting");
}

const PASS_PLAY: Record<CoachPersonality, string[]> = {
  friendly: ["Pass & play — have fun, and shake hands whoever wins!", "Two players, one board. Good luck to both of you!"],
  strict: ["Pass & play. Play seriously — every move counts.", "Face each other. No takebacks."],
  mentor: ["Pass & play — explain your ideas to each other between moves.", "Use this game to practice calculating together."],
  tactical: ["Pass & play — sharp eyes win brawls.", "Attack and defend — may the best calc win."],
  minimal: ["Your move.", "Play."],
};

export function passPlayGreeting(personality: CoachPersonality): string {
  const seed = hash(`pass:${personality}`);
  return applyCoachLine(pick(PASS_PLAY[personality], seed), personality, "greeting");
}
