import type { PieceType, Square } from "./board";
import { load } from "./game";

/** A move the learner said, ready to confirm. */
export type SpokenOption = { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n"; san: string };
export type SpokenMove = { kind: "move"; move: SpokenOption } | { kind: "ambiguous"; options: SpokenOption[] } | { kind: "none" };

type Tok =
  | { t: "piece"; p: PieceType }
  | { t: "file"; f: string; strict: boolean }
  | { t: "rank"; r: string; strict: boolean }
  | { t: "take" }
  | { t: "castle" }
  | { t: "short" }
  | { t: "long" };

// Hindi spellings vary (nukta, chandrabindu): keys and input go through the same fold.
const fold = (s: string) => s.normalize("NFD").replace(/़/g, "").replace(/ँ/g, "ं").normalize("NFC");

const WORDS: Record<string, Tok> = {};
const add = (tok: Tok, ...words: string[]) => words.forEach((w) => (WORDS[fold(w)] = tok));
const piece = (p: PieceType) => ({ t: "piece", p }) as Tok;
add(piece("n"), "knight", "knights", "night", "nite", "घोड़ा", "घोड़े", "घोड़ी", "नाइट");
add(piece("b"), "bishop", "bishops", "ऊँट", "बिशप");
add(piece("r"), "rook", "rooks", "rock", "हाथी", "रूक");
add(piece("q"), "queen", "queens", "रानी", "वज़ीर", "वजीर", "क्वीन");
add(piece("k"), "king", "kings", "राजा", "किंग");
add(piece("p"), "pawn", "pawns", "prawn", "प्यादा", "प्यादे", "पॉन", "पोन");
add({ t: "take" }, "takes", "take", "captures", "capture", "x", "मारे", "मारो", "मारता", "मारेगा", "काटे", "काटो", "टेक्स", "टेक");
add({ t: "castle" }, "castle", "castles", "castling", "कैसलिंग", "कैसल");
add({ t: "short" }, "kingside", "short", "छोटा", "छोटी", "किंगसाइड");
add({ t: "long" }, "queenside", "long", "लंबा", "लंबी", "बड़ा", "बड़ी", "क्वीनसाइड");
const files: [string, string[], string[]][] = [
  ["a", ["a"], ["ए"]],
  ["b", ["b"], ["be", "bee", "बी"]],
  ["c", ["c"], ["see", "sea", "सी"]],
  ["d", ["d"], ["dee", "डी"]],
  ["e", ["e"], ["ई", "इ"]],
  ["f", ["f"], ["ef", "eff", "एफ", "एफ़"]],
  ["g", ["g"], ["gee", "jee", "जी"]],
  ["h", ["h"], ["aitch", "एच"]],
];
for (const [f, strict, loose] of files) {
  add({ t: "file", f, strict: true }, ...strict);
  add({ t: "file", f, strict: false }, ...loose);
}
const ranks: [string, string[], string[]][] = [
  ["1", ["one", "एक", "१"], ["won"]],
  ["2", ["two", "दो", "२"], ["to", "too"]],
  ["3", ["three", "तीन", "३"], ["tree"]],
  ["4", ["four", "चार", "४"], ["for", "fore"]],
  ["5", ["five", "पाँच", "पांच", "५"], []],
  ["6", ["six", "छह", "छः", "छे", "छै", "६"], []],
  ["7", ["seven", "सात", "७"], []],
  ["8", ["eight", "आठ", "८"], ["ate"]],
];
for (const [r, strict, loose] of ranks) {
  add({ t: "rank", r, strict: true }, r, ...strict);
  add({ t: "rank", r, strict: false }, ...loose);
}

function tokens(text: string): Tok[] {
  const s = fold(text.toLowerCase())
    .replace(/\b(king|queen)\s+side\b/g, "$1side")
    .replace(/\bo-o-o\b|\b0-0-0\b/g, " castle long ")
    .replace(/\bo-o\b|\b0-0\b/g, " castle short ")
    // "f3", "एफ3", "nf3": split letters from digits and scripts from each other.
    .replace(/([\u0900-\u0965\u0970-\u097F])(?=[\u0966-\u096F])|([a-z])(?=[0-9])|([0-9])(?=[a-z])|([ऀ-ॿ])(?=[a-z0-9])|([a-z0-9])(?=[ऀ-ॿ])/g, "$& ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ");
  const out: Tok[] = [];
  for (const w of s.split(" ").filter(Boolean)) {
    const tok = WORDS[w];
    if (tok) out.push(tok);
    else if (/^[kqrbn][a-h]$/.test(w)) out.push(piece(w[0] as PieceType), WORDS[w[1]]); // "nf" from "Nf3"
    else if (/^[a-h]x[a-h]$/.test(w)) out.push(WORDS[w[0]], { t: "take" }, WORDS[w[2]]); // "exd" from "exd5"
  }
  return out;
}

type Want = { piece?: PieceType; promo?: PieceType; victim?: PieceType; take: boolean; to?: Square; from?: Square; fromFile?: string; castle?: "short" | "long" | "any" };

function understand(toks: Tok[]): Want {
  const w: Want = { take: false };
  const squares: Square[] = [];
  let side: "short" | "long" | undefined;
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i];
    const b = toks[i + 1];
    if (a.t === "file" && b?.t === "rank" && (a.strict || b.strict)) {
      squares.push(`${a.f}${b.r}` as Square);
      i++;
    } else if (a.t === "file" && a.strict && !squares.length && (b?.t === "take" || b?.t === "file")) w.fromFile = a.f;
    else if (a.t === "take") w.take = true;
    else if (a.t === "castle") w.castle = "any";
    else if (a.t === "short" || a.t === "long") side = a.t;
    else if (a.t === "piece") {
      if (squares.length) w.promo ??= a.p;
      else if (w.take) w.victim ??= a.p;
      else w.piece ??= a.p;
    }
  }
  if (w.castle) {
    // "castle king side" / "castle queen side" arrive as piece words.
    const named = side ?? (w.piece === "k" || w.promo === "k" ? "short" : w.piece === "q" || w.promo === "q" ? "long" : undefined);
    return { take: false, castle: named ?? "any" };
  }
  if (squares.length >= 2) [w.from, w.to] = squares.slice(-2);
  else w.to = squares[0];
  return w;
}

function choose(fen: string, text: string): SpokenMove {
  const chess = load(fen);
  const legal = chess.moves({ verbose: true });
  const option = (m: (typeof legal)[number]): SpokenOption => ({ from: m.from as Square, to: m.to as Square, ...(m.promotion ? { promotion: m.promotion as SpokenOption["promotion"] } : {}), san: m.san });
  // Written SAN ("Nf3", "exd5") straight from a recogniser.
  const direct = legal.find((m) => m.san.replace(/[+#]/g, "").toLowerCase() === text.replace(/[\s+#!?]/g, "").toLowerCase());
  if (direct) return { kind: "move", move: option(direct) };
  const w = understand(tokens(text));
  let hits = legal;
  if (w.castle) hits = hits.filter((m) => (w.castle === "long" ? m.san.startsWith("O-O-O") : w.castle === "short" ? /^O-O(?!-O)/.test(m.san) : m.san.startsWith("O-O")));
  else {
    if (!w.to && !w.piece && !w.victim) return { kind: "none" };
    if (w.to) hits = hits.filter((m) => m.to === w.to);
    if (w.from) hits = hits.filter((m) => m.from === w.from);
    if (w.fromFile) hits = hits.filter((m) => m.from[0] === w.fromFile);
    if (w.piece) hits = hits.filter((m) => m.piece === w.piece);
    if (w.take) hits = hits.filter((m) => m.captured);
    if (w.victim) hits = hits.filter((m) => m.captured === w.victim);
    if (w.promo) hits = hits.filter((m) => m.promotion === w.promo);
    // "e4" means the pawn, as in written notation.
    if (!w.piece && hits.some((m) => m.piece === "p")) hits = hits.filter((m) => m.piece === "p");
  }
  if (hits.length === 1) return { kind: "move", move: option(hits[0]) };
  return hits.length ? { kind: "ambiguous", options: hits.map(option) } : { kind: "none" };
}

/**
 * Turns what a speech recogniser heard into a legal move for `fen`. Recognisers return several guesses:
 * the first clear move wins, then the first ambiguous one (the app asks which piece), else "none".
 */
export function parseSpokenMove(fen: string, heard: string | readonly string[]): SpokenMove {
  let fallback: SpokenMove = { kind: "none" };
  for (const text of typeof heard === "string" ? [heard] : heard) {
    const r = choose(fen, text);
    if (r.kind === "move") return r;
    if (r.kind === "ambiguous" && fallback.kind === "none") fallback = r;
  }
  return fallback;
}
