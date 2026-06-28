/**
 * ChessSchool DB seeder + lesson generator.
 *
 * Generates 1,200–1,800 FEN-verified lessons (captures, checks, promotions,
 * back-rank mates) plus the famous openings, organised into classes/semesters,
 * and inserts them into the SQLite DB. Every position/move is validated with
 * chess.js before it is written — no broken lesson can be seeded.
 *
 * Run: pnpm db:seed   (or pnpm db:fresh to reset + push + seed)
 */
import Database from "better-sqlite3";
import { Chess } from "chess.js";
import { SEMESTERS as CURATED_SEMS } from "../content/data/school.mjs";
import { LESSONS as CURATED_LESSONS } from "../content/data/lessons.mjs";

const DB_PATH = (process.env.DATABASE_URL ?? "local.db").replace(/^file:/, "");
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const sq = (f, r) => `${FILES[f]}${r}`;
const rint = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rint(arr.length)];
const PIECE_NAME = { q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const PIECE_EMOJI = { q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

// Build a FEN from an explicit piece list. White uppercase, black lowercase.
function buildFen(pieces, turn = "w") {
  const board = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (const { f, r, p } of pieces) board[8 - r][f] = p;
  const rows = board.map((row) => {
    let s = "";
    let empty = 0;
    for (const cell of row) {
      if (!cell) empty++;
      else {
        if (empty) s += empty;
        empty = 0;
        s += cell;
      }
    }
    if (empty) s += empty;
    return s;
  });
  return `${rows.join("/")} ${turn} - - 0 1`;
}

const infoStep = (id, coach, fen) => ({ id, kind: "info", coach, fen });
const moveStep = (id, coach, fen, solution, opts = {}) => ({
  id,
  kind: "move",
  coach,
  fen,
  solution,
  highlight: opts.highlight,
  successText: opts.successText ?? "Correct!",
  failText: opts.failText ?? "Not quite — try again.",
  tag: opts.tag,
});

// ── Generators (random kings → high variety, all chess.js-verified) ──────────
const cheb = (a, b) => Math.max(Math.abs(a.f - b.f), Math.abs(a.r - b.r));
function randSq(occupied) {
  for (let i = 0; i < 200; i++) {
    const f = rint(8),
      r = 1 + rint(8);
    if (!occupied.has(sq(f, r))) return { f, r };
  }
  return null;
}
function placeKings() {
  const occ = new Set();
  const wk = { f: rint(8), r: 1 + rint(8), p: "K" };
  occ.add(sq(wk.f, wk.r));
  for (let i = 0; i < 50; i++) {
    const bk = { f: rint(8), r: 1 + rint(8), p: "k" };
    if (cheb(wk, bk) >= 2) {
      occ.add(sq(bk.f, bk.r));
      return { wk, bk, occ };
    }
  }
  return null;
}

function genCapture() {
  const attackerType = pick(["q", "r", "b", "n"]);
  const targetType = pick(["r", "b", "n", "p"]);
  const k = placeKings();
  if (!k) return null;
  const { wk, bk, occ } = k;
  const a = randSq(occ);
  if (!a) return null;
  occ.add(sq(a.f, a.r));
  const bkSq = sq(bk.f, bk.r);
  // squares the attacker reaches (to empty), used as candidate target squares
  let g0;
  try {
    g0 = new Chess(buildFen([wk, bk, { ...a, p: attackerType.toUpperCase() }], "w"));
  } catch {
    return null;
  }
  if (g0.isAttacked(bkSq, "w")) return null;
  const from = sq(a.f, a.r);
  const reach = g0
    .moves({ square: from, verbose: true })
    .map((m) => m.to)
    .filter((t) => {
      const tf = FILES.indexOf(t[0]),
        tr = Number(t[1]);
      return cheb({ f: tf, r: tr }, bk) >= 2; // target undefended by black king
    });
  if (!reach.length) return null;
  const to = pick(reach);
  const tf = FILES.indexOf(to[0]),
    tr = Number(to[1]);
  const fen = buildFen(
    [wk, bk, { ...a, p: attackerType.toUpperCase() }, { f: tf, r: tr, p: targetType }],
    "w",
  );
  let g;
  try {
    g = new Chess(fen);
  } catch {
    return null;
  }
  if (g.isAttacked(bkSq, "w")) return null;
  if (!g.moves({ square: from, verbose: true }).some((m) => m.to === to && m.flags.includes("c")))
    return null;
  return {
    tag: "capture",
    title: `Win the ${PIECE_NAME[targetType]}`,
    subtitle: "Free material",
    emoji: PIECE_EMOJI[targetType],
    xp: 10,
    steps: [
      moveStep(
        "win",
        `The ${PIECE_NAME[targetType]} on ${to} is undefended. Capture it with your ${PIECE_NAME[attackerType]}!`,
        fen,
        [`${from}:${to}`],
        { highlight: [to], tag: "capture", successText: "Free piece — well spotted!" },
      ),
    ],
  };
}

function genCheck() {
  const attackerType = pick(["q", "r", "b", "n"]);
  const k = placeKings();
  if (!k) return null;
  const { wk, bk, occ } = k;
  const a = randSq(occ);
  if (!a) return null;
  const fen = buildFen([wk, bk, { ...a, p: attackerType.toUpperCase() }], "w");
  let g;
  try {
    g = new Chess(fen);
  } catch {
    return null;
  }
  if (g.isAttacked(sq(bk.f, bk.r), "w")) return null;
  const from = sq(a.f, a.r);
  const checks = g.moves({ square: from, verbose: true }).filter((m) => {
    const c = new Chess(fen);
    c.move({ from: m.from, to: m.to });
    return c.isCheck();
  });
  if (!checks.length) return null;
  const m = pick(checks);
  return {
    tag: "check",
    title: "Give a check",
    subtitle: "Attack the king",
    emoji: "⚡",
    xp: 10,
    steps: [
      moveStep(
        "check",
        `Find the move that puts the black king in check with your ${PIECE_NAME[attackerType]}.`,
        fen,
        [`${m.from}:${m.to}`],
        { highlight: [sq(bk.f, bk.r)], tag: "check", successText: "Check!" },
      ),
    ],
  };
}

function genPromotion() {
  const k = placeKings();
  if (!k) return null;
  const { wk, bk, occ } = k;
  // pawn on the 7th rank with an empty square ahead
  for (let i = 0; i < 20; i++) {
    const f = rint(8);
    if (occ.has(sq(f, 7)) || occ.has(sq(f, 8))) continue;
    const fen = buildFen([wk, bk, { f, r: 7, p: "P" }], "w");
    let g;
    try {
      g = new Chess(fen);
    } catch {
      continue;
    }
    if (g.isAttacked(sq(bk.f, bk.r), "w")) continue;
    const from = sq(f, 7),
      to = sq(f, 8);
    if (!g.moves({ square: from, verbose: true }).some((x) => x.to === to)) continue;
    return {
      tag: "endgame",
      title: "Queen the pawn",
      subtitle: "Promotion",
      emoji: "👑",
      xp: 12,
      steps: [
        moveStep("promote", "Push the pawn to the last rank and promote to a queen!", fen, [`${from}:${to}`], {
          highlight: [to],
          tag: "promotion",
          successText: "A brand-new queen!",
        }),
      ],
    };
  }
  return null;
}

function genBackRankMate() {
  const usePiece = pick(["r", "q"]);
  for (let tries = 0; tries < 30; tries++) {
    const kf = rint(8);
    const wkf = rint(8);
    const wkr = 1 + rint(3);
    if (cheb({ f: wkf, r: wkr }, { f: kf, r: 8 }) < 2) continue;
    const pieces = [
      { f: wkf, r: wkr, p: "K" },
      { f: kf, r: 8, p: "k" },
    ];
    for (const df of [-1, 0, 1]) {
      const pf = kf + df;
      if (pf >= 0 && pf <= 7) pieces.push({ f: pf, r: 7, p: "p" });
    }
    const rfCandidates = [0, 1, 2, 3, 4, 5, 6, 7].filter(
      (rf) => Math.abs(rf - kf) >= 2 && rf !== wkf,
    );
    if (!rfCandidates.length) continue;
    const rf = pick(rfCandidates);
    if (pieces.some((p) => p.f === rf && p.r === 1)) continue;
    pieces.push({ f: rf, r: 1, p: usePiece.toUpperCase() });
    const fen = buildFen(pieces, "w");
    let g;
    try {
      g = new Chess(fen);
    } catch {
      continue;
    }
    const from = sq(rf, 1),
      to = sq(rf, 8);
    if (!g.moves({ square: from, verbose: true }).some((m) => m.to === to)) continue;
    const test = new Chess(fen);
    test.move({ from, to });
    if (!test.isCheckmate()) continue;
    return {
      tag: "checkmate",
      title: "Back-rank mate",
      subtitle: "Mate in one",
      emoji: "♛",
      xp: 15,
      steps: [
        moveStep("mate", "The king is trapped on the back rank by its own pawns. Deliver mate!", fen, [`${from}:${to}`], {
          highlight: [sq(kf, 8)],
          tag: "checkmate",
          successText: "Checkmate!",
        }),
      ],
    };
  }
  return null;
}

const OPENINGS = [
  ["Italian Game", "1.e4 e5 2.Nf3 Nc6 3.Bc4", "🇮🇹", ["e2:e4", "e7:e5", "g1:f3", "b8:c6", "f1:c4"]],
  ["Ruy Lopez", "1.e4 e5 2.Nf3 Nc6 3.Bb5", "🇪🇸", ["e2:e4", "e7:e5", "g1:f3", "b8:c6", "f1:b5"]],
  ["Sicilian Defense", "The Open Sicilian", "⚔️", ["e2:e4", "c7:c5", "g1:f3", "d7:d6", "d2:d4", "c5:d4", "f3:d4", "g8:f6", "b1:c3"]],
  ["French Defense", "1.e4 e6 2.d4 d5", "🇫🇷", ["e2:e4", "e7:e6", "d2:d4", "d7:d5"]],
  ["Caro-Kann", "1.e4 c6 2.d4 d5", "🛡️", ["e2:e4", "c7:c6", "d2:d4", "d7:d5"]],
  ["Scandinavian", "1.e4 d5", "🇩🇰", ["e2:e4", "d7:d5", "e4:d5", "d8:d5", "b1:c3"]],
  ["Queen's Gambit", "1.d4 d5 2.c4", "♕", ["d2:d4", "d7:d5", "c2:c4"]],
  ["King's Indian", "1.d4 Nf6 2.c4 g6", "🏰", ["d2:d4", "g8:f6", "c2:c4", "g7:g6", "b1:c3", "f8:g7"]],
  ["London System", "1.d4 d5 2.Nf3 Nf6 3.Bf4", "🌉", ["d2:d4", "d7:d5", "g1:f3", "g8:f6", "c1:f4"]],
  ["English Opening", "1.c4 e5 2.Nc3", "🏴", ["c2:c4", "e7:e5", "b1:c3"]],
];

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
function genOpening([name, sub, emoji, moves]) {
  const g = new Chess();
  for (const mv of moves) {
    const [from, to] = mv.split(":");
    if (!g.move({ from, to, promotion: "q" })) return null; // verify
  }
  return {
    tag: "openings",
    title: name,
    subtitle: sub,
    emoji,
    xp: 25,
    steps: [
      infoStep("intro", `The ${name} — one of chess's great openings. Watch the main line, then play the key move.`, START_FEN),
      { id: "watch", kind: "observe", coach: `Watch the ${name} unfold move by move.`, fen: START_FEN, moves },
      moveStep("first", "Now you start it — play the opening's first move.", START_FEN, [moves[0]], {
        tag: "openings",
        successText: "Great start!",
      }),
    ],
  };
}

function collect(gen, target, label) {
  const out = [];
  const seen = new Set();
  let attempts = 0;
  while (out.length < target && attempts < target * 30) {
    attempts++;
    const lesson = gen();
    if (!lesson) continue;
    const key = JSON.stringify(lesson.steps.map((s) => s.fen + (s.solution ?? "")));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lesson);
  }
  console.log(`  ${label}: ${out.length}/${target}`);
  return out;
}

// ── Assemble curriculum ─────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log("Generating verified lessons…");
  const captures = collect(genCapture, 700, "captures");
  const checks = collect(genCheck, 400, "checks");
  const promos = collect(genPromotion, 250, "promotions");
  const mates = collect(genBackRankMate, 250, "back-rank mates");
  const openings = OPENINGS.map(genOpening).filter(Boolean);

  const semesters = [];
  const classes = [];
  const lessons = [];
  let cOrder = 0;

  // Bundle several drills into one multi-exercise lesson, and scale the lesson
  // count + exercises-per-lesson by difficulty (easy classes are short; harder
  // / higher classes are longer and give more XP).
  function addThemeSemester(semId, title, blurb, color, stage, pool, classTitle, emoji, difficulty) {
    const perLesson = Math.min(difficulty + 1, 6); // exercises (FENs) per lesson
    const perClass = (4 + difficulty * 2) * perLesson; // → 6/8/10/12 lessons per class
    semesters.push({ id: semId, title, blurb, color, stage, sortOrder: semesters.length });
    chunk(pool, perClass).forEach((group, ci) => {
      const classId = `${semId}-c${ci + 1}`;
      const lessonGroups = chunk(group, perLesson);
      classes.push({
        id: classId,
        semesterId: semId,
        title: `${classTitle} ${ci + 1}`,
        emoji,
        blurb: `${lessonGroups.length} lessons`,
        difficulty,
        sortOrder: cOrder++,
      });
      lessonGroups.forEach((drills, li) => {
        // Merge the drills' positions into one lesson as sequential exercises.
        const steps = drills.flatMap((d, di) => d.steps.map((s, si) => ({ ...s, id: `e${di}s${si}` })));
        lessons.push({
          id: `${classId}-l${li + 1}`,
          classId,
          title: drills[0].title,
          subtitle: drills.length > 1 ? `${drills.length} exercises` : drills[0].subtitle,
          emoji: drills[0].emoji,
          tag: drills[0].tag,
          xp: drills.length * 10,
          isExam: 0,
          prerequisites: "[]",
          steps: JSON.stringify(steps),
          sortOrder: li,
        });
      });
    });
  }

  // Curated, hand-authored curriculum first (Elementary foundations, openings…)
  function addCurated() {
    const byId = new Map(CURATED_LESSONS.map((l) => [l.id, l]));
    const pushLesson = (l, classId, sortOrder, isExam = 0) =>
      lessons.push({
        id: l.id, classId, title: l.title, subtitle: l.subtitle, emoji: l.emoji,
        tag: l.tag, xp: l.xp, isExam,
        prerequisites: JSON.stringify(l.prerequisites ?? []),
        steps: JSON.stringify(l.steps), sortOrder,
      });
    for (const sem of CURATED_SEMS) {
      semesters.push({ id: sem.id, title: sem.title, blurb: sem.blurb, color: sem.color, stage: sem.stage, sortOrder: semesters.length });
      for (const cls of sem.classes) {
        classes.push({ id: cls.id, semesterId: sem.id, title: cls.title, emoji: cls.emoji, blurb: cls.blurb, difficulty: cls.difficulty ?? 1, examId: cls.examId ?? null, sortOrder: cOrder++ });
        cls.lessonIds.forEach((lid, li) => { const l = byId.get(lid); if (l) pushLesson(l, cls.id, li); });
        if (cls.examId) { const ex = byId.get(cls.examId); if (ex) pushLesson(ex, cls.id, 99, 1); }
      }
    }
  }
  addCurated();

  // difficulty grows through the ladder: easy → fewer/shorter, hard → more/longer
  addThemeSemester("sem-gen-promo", "Pawn Promotion", "Queen your pawns", "#0f7a55", "elementary", promos, "Promotion Power", "👑", 1);
  addThemeSemester("sem-gen-captures", "Tactics · Free Material", "Win undefended pieces", "#cf4324", "middle", captures, "Free Material", "🎯", 2);
  addThemeSemester("sem-gen-checks", "Tactics · Spot the Check", "Find forcing checks", "#5b5bd6", "middle", checks, "Spot the Check", "⚡", 3);
  addThemeSemester("sem-gen-mates", "Checkmate School", "Mate in one", "#7c5cd6", "middle", mates, "Mate in One", "♛", 4);

  // Openings — one class per opening
  semesters.push({ id: "sem-gen-openings", title: "Opening Repertoire", blurb: "The famous openings", color: "#f59e0b", stage: "elementary", sortOrder: semesters.length });
  openings.forEach((l, oi) => {
    const classId = `sem-gen-openings-c${oi + 1}`;
    classes.push({ id: classId, semesterId: "sem-gen-openings", title: l.title, emoji: l.emoji, blurb: l.subtitle, difficulty: 2, sortOrder: cOrder++ });
    lessons.push({
      id: `${classId}-l1`,
      classId,
      title: l.title,
      subtitle: l.subtitle,
      emoji: l.emoji,
      tag: l.tag,
      xp: l.xp,
      isExam: 0,
      prerequisites: "[]",
      steps: JSON.stringify(l.steps),
      sortOrder: 0,
    });
  });

  console.log(`\nTotals: ${semesters.length} semesters · ${classes.length} classes · ${lessons.length} lessons`);

  const SEM_SQL = "INSERT INTO semesters (id,title,blurb,color,stage,sort_order) VALUES (?,?,?,?,?,?)";
  const CLASS_SQL = "INSERT INTO classes (id,semester_id,title,emoji,blurb,difficulty,exam_id,sort_order) VALUES (?,?,?,?,?,?,?,?)";
  const LESSON_SQL = "INSERT INTO lessons (id,class_id,title,subtitle,emoji,tag,xp,is_exam,prerequisites,steps,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
  const semArgs = (s) => [s.id, s.title, s.blurb, s.color, s.stage, s.sortOrder];
  const classArgs = (c) => [c.id, c.semesterId, c.title, c.emoji, c.blurb, c.difficulty, c.examId ?? null, c.sortOrder];
  const lessonArgs = (l) => [l.id, l.classId, l.title, l.subtitle, l.emoji, l.tag, l.xp, l.isExam, l.prerequisites, l.steps, l.sortOrder];

  const rawUrl = process.env.DATABASE_URL ?? "file:local.db";
  const isRemote = rawUrl.startsWith("libsql:") || rawUrl.startsWith("http");

  if (isRemote) {
    // ── Turso / libSQL (async, batched) ──────────────────────────────────────
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url: rawUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
    await client.batch(["DELETE FROM lessons", "DELETE FROM classes", "DELETE FROM semesters"], "write");
    const stmts = [
      ...semesters.map((s) => ({ sql: SEM_SQL, args: semArgs(s) })),
      ...classes.map((c) => ({ sql: CLASS_SQL, args: classArgs(c) })),
      ...lessons.map((l) => ({ sql: LESSON_SQL, args: lessonArgs(l) })),
    ];
    for (let i = 0; i < stmts.length; i += 400) {
      await client.batch(stmts.slice(i, i + 400), "write");
      process.stdout.write(`\r  inserting… ${Math.min(i + 400, stmts.length)}/${stmts.length}`);
    }
    console.log(`\n✅ Seeded ${lessons.length} lessons into ${rawUrl}`);
    return;
  }

  // ── Local SQLite file (sync, fast) ─────────────────────────────────────────
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  db.exec("DELETE FROM lessons; DELETE FROM classes; DELETE FROM semesters;");
  const insSem = db.prepare(SEM_SQL);
  const insClass = db.prepare(CLASS_SQL);
  const insLesson = db.prepare(LESSON_SQL);
  const tx = db.transaction(() => {
    for (const s of semesters) insSem.run(semArgs(s));
    for (const c of classes) insClass.run(classArgs(c));
    for (const l of lessons) insLesson.run(lessonArgs(l));
  });
  tx();
  const count = db.prepare("SELECT COUNT(*) c FROM lessons").get().c;
  console.log(`\n✅ Seeded ${count} lessons into ${DB_PATH}`);
  db.close();
}

await main();
