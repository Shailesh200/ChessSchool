import { copy } from "./copy";

type Piece = "k" | "q" | "r" | "b" | "n" | "p";
type Verdict = "good" | "inaccuracy" | "mistake" | "blunder";

/** The board facts of one move (the shape of @chessschool/chess `MoveFacts`). */
export type StoryFacts = {
  san: string;
  verdict: Verdict;
  lossPiece: Piece | null;
  better: string | null;
  captured: Piece | null;
  check: boolean;
  mate: boolean;
  missedMate: boolean;
  allowedMate: string | null;
  hanging: { square: string; piece: Piece } | null;
  freeCapture: { square: string; piece: Piece } | null;
  fork: readonly Piece[] | null;
  pin: Piece | null;
  threat: { san: string; kind: "fork" | "pin" } | null;
};

/** What the key-moment card needs to know about the decisive move (from @chessschool/chess review + detector). */
export type KeyMomentFacts = { kind: "mistake" | "great"; verdict: Verdict; better: string | null; tags: readonly string[]; facts?: StoryFacts | null };

const piece = (p: Piece) => copy.analysisBoard.pieces[p];

/**
 * A move explained in plain words for a child, from the engine's facts only: what went wrong (a mate allowed,
 * a piece left loose, a fork or pin allowed), what was better and why (a mate, a free piece, a fork, a pin),
 * what it cost, and one tip. `mine` false: the opponent's move, told as a chance for the learner.
 */
export function moveStory(f: StoryFacts, mine = true): string {
  const w = copy.analysis.why;
  if (f.mate) return copy.analysis.explain.mate;
  if (!mine) {
    if (f.verdict === "good") return copy.analysis.explain.opponent;
    if (f.hanging) return w.opponentLoose(piece(f.hanging.piece), f.hanging.square);
    return f.verdict === "inaccuracy" ? copy.analysis.explain.opponent : w.opponentSlip;
  }
  if (f.verdict === "good") {
    if (f.check) return w.check;
    if (f.captured) return w.capture(piece(f.captured));
    return copy.analysis.explain.good;
  }
  const out: string[] = [];
  // What went wrong.
  if (f.allowedMate) out.push(w.allowedMate(f.allowedMate));
  else if (f.hanging) out.push(w.hanging(piece(f.hanging.piece), f.hanging.square));
  else if (f.threat) out.push(f.threat.kind === "fork" ? w.threatFork(f.threat.san) : w.threatPin(f.threat.san));
  // What was better, and why.
  if (f.better) {
    if (f.missedMate) out.push(w.missedMate(f.better));
    else if (f.freeCapture) out.push(w.freeCapture(f.better, piece(f.freeCapture.piece)));
    else if (f.fork?.length) out.push(w.fork(f.better));
    else if (f.pin) out.push(w.pin(f.better, piece(f.pin)));
    else out.push(w.better(f.better));
  }
  // What it cost (a missed or allowed mate says enough).
  const cost = f.lossPiece === "p" || f.lossPiece === "n" || f.lossPiece === "r" || f.lossPiece === "q" ? w.costPieces[f.lossPiece] : null;
  if (cost && !f.allowedMate && !f.missedMate) out.push(w.cost(cost));
  if (!out.length) out.push(f.verdict === "inaccuracy" ? copy.analysis.explain.inaccuracy(null) : f.verdict === "mistake" ? copy.analysis.explain.mistake(null) : copy.analysis.explain.blunder(null));
  if (f.verdict !== "inaccuracy") out.push(f.allowedMate ? w.tipChecks : f.hanging ? w.tipSafety : w.tipLook);
  return out.join(" ");
}

/** The card's one line: the coach's saved note when there is one, else the plain-words story, else the detector tag. No AI call. */
export function keyMomentText(m: KeyMomentFacts, coachNote?: string | null): string {
  if (coachNote?.trim()) return coachNote.trim();
  if (m.kind === "great") return copy.keyMoment.greatBody;
  if (m.facts) return moveStory(m.facts);
  const tag = m.tags.map((t) => copy.keyMoment.tags[t as keyof typeof copy.keyMoment.tags]).find(Boolean);
  if (tag) return tag;
  return m.verdict === "good" ? copy.analysis.explain.good : copy.analysis.explain[m.verdict](m.better);
}
