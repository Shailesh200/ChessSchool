import {
  chooseMove,
  legalTargets,
  load,
  readFen,
  runnerReduce,
  startRunner,
  type PromotionPiece,
  type RunnerState,
  type Square,
  type Step,
} from "@chessschool/chess";

export type CourseUnitDoc = { id: string; title: string; sub: string };
export type CourseLessonDoc = { id: string; unit: string; title: string; sub: string; minutes: number; xp: number; steps: Step[] };
export type ComingSoonDoc = { id: string; title: string; sub: string };
export type CourseDoc = { version: string; units: CourseUnitDoc[]; lessons: CourseLessonDoc[]; comingSoon: ComingSoonDoc[] };

export type CourseCheck = { ok: true; doc: CourseDoc } | { ok: false; errors: string[] };

const ID = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const STEP_KINDS = new Set(["say", "tap", "move", "stars", "choice", "game", "line"]);
const text = (v: unknown, max = 400) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const int = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/* ---------- playing a lesson with the app's runner ---------- */

function tapMove(s: RunnerState, from: Square, to: Square, promo: PromotionPiece = "q"): RunnerState {
  const after = runnerReduce(runnerReduce(s, { type: "tap", square: from }), { type: "tap", square: to });
  return after.promotion ? runnerReduce(after, { type: "promote", piece: promo }) : after;
}

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function solveStars(s: RunnerState): RunnerState | null {
  const queue: RunnerState[] = [s];
  const seen = new Set<string>([`${s.fen}|${s.stars.join()}`]);
  for (let head = 0; head < queue.length && head < 5000; head++) {
    const cur = queue[head]!;
    if (cur.status === "ready") return cur;
    const own = [...readFen(cur.fen).entries()].find(([, p]) => p.color === "w");
    if (!own) return null;
    for (const to of legalTargets(load(cur.fen), own[0])) {
      const key = `${to}|${cur.stars.filter((sq) => sq !== to).join()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(tapMove(cur, own[0], to));
    }
  }
  return null;
}

/** Plays one step to "ready" the way a learner would, or explains why it can't be done. */
function solveStep(s: RunnerState, step: Step): { state: RunnerState; error?: string } {
  switch (step.kind) {
    case "say":
      return { state: s };
    case "tap":
      return { state: runnerReduce(s, { type: "tap", square: step.targets[0]! }) };
    case "choice":
      return { state: runnerReduce(s, { type: "choose", index: step.options.findIndex((o) => o.correct) }) };
    case "stars": {
      const done = solveStars(s);
      return done ? { state: done } : { state: s, error: "stars cannot all be reached" };
    }
    case "move": {
      const legal = load(s.fen).moves({ verbose: true });
      const solving = legal.filter((m) => tapMove(s, m.from as Square, m.to as Square).status === "ready");
      if (!solving.length) return { state: s, error: "no legal move meets the goal" };
      if (solving.length === legal.length) return { state: s, error: "every legal move meets the goal" };
      return { state: tapMove(s, solving[0]!.from as Square, solving[0]!.to as Square) };
    }
    case "line": {
      let cur = s;
      for (let guard = 0; cur.status !== "ready" && guard < 64; guard++) {
        const m = step.moves[cur.lineStep];
        if (!m) return { state: cur, error: "line ended early" };
        if (cur.botThinking) {
          cur = runnerReduce(cur, { type: "bot", move: { from: m.slice(0, 2) as Square, to: m.slice(2, 4) as Square } });
          continue;
        }
        const next = tapMove(cur, m.slice(0, 2) as Square, m.slice(2, 4) as Square, (m[4] as PromotionPiece) || "q");
        const stuck = next.fen === cur.fen && next.lineStep === cur.lineStep && next.status === cur.status;
        if (next === cur || stuck || next.misses > cur.misses) return { state: cur, error: `line move ${m} is not accepted` };
        cur = next;
      }
      return cur.status === "ready" ? { state: cur } : { state: cur, error: "line never finishes" };
    }
    case "game": {
      let cur = s;
      const rand = seeded();
      for (let i = 0; i < 200 && cur.status !== "ready"; i++) {
        if (cur.botThinking || cur.gameMoves < step.minMoves) {
          const m = chooseMove(cur.fen, "gentle", rand);
          if (!m) break;
          cur = cur.botThinking
            ? runnerReduce(cur, { type: "bot", move: { from: m.from as Square, to: m.to as Square } })
            : tapMove(cur, m.from as Square, m.to as Square);
        } else cur = runnerReduce(cur, { type: "endGame" });
      }
      return cur.status === "ready" ? { state: cur } : { state: cur, error: "game step never finishes" };
    }
  }
}

function checkSteps(id: string, steps: unknown, errors: string[]) {
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push(`${id}: steps must be a non-empty array`);
    return;
  }
  const before = errors.length;
  steps.forEach((raw, i) => {
    const at = `${id} step ${i + 1}`;
    const st = raw as Partial<Step> & Record<string, unknown>;
    if (!st || typeof st !== "object" || !STEP_KINDS.has(String(st.kind))) return errors.push(`${at}: unknown kind`);
    if (!text(st.title) || !text(st.body, 600) || typeof st.fen !== "string") errors.push(`${at}: title, body and fen are required`);
    if (st.kind === "choice") {
      const options = Array.isArray(st.options) ? (st.options as { label?: unknown; correct?: unknown }[]) : [];
      if (options.length < 2 || options.some((o) => !text(o.label, 160))) errors.push(`${at}: a choice needs at least two labelled options`);
      if (options.filter((o) => o.correct === true).length !== 1) errors.push(`${at}: a choice needs exactly one correct option`);
    }
    if (st.kind === "tap" && (!Array.isArray(st.targets) || st.targets.length === 0)) errors.push(`${at}: tap needs targets`);
    if (st.kind === "stars" && (!Array.isArray(st.stars) || st.stars.length === 0)) errors.push(`${at}: stars needs stars`);
    if (st.kind === "line" && (!Array.isArray(st.moves) || st.moves.length % 2 === 0)) errors.push(`${at}: a line needs an odd number of moves (learner first and last)`);
  });
  if (errors.length > before) return;
  try {
    const list = steps as Step[];
    let s = startRunner(list);
    for (const [i, step] of list.entries()) {
      const { state, error } = solveStep(s, step);
      if (error || state.status !== "ready") return errors.push(`${id} step ${i + 1} (${step.title}): ${error ?? "cannot be finished"}`);
      s = runnerReduce(state, { type: "next" });
    }
    if (s.status !== "finished") errors.push(`${id}: lesson does not finish`);
  } catch (err) {
    errors.push(`${id}: ${String(err instanceof Error ? err.message : err)}`);
  }
}

/** Validates a course document: shape, ids, order, and that every lesson can be played to the end. */
export function checkCourse(raw: unknown): CourseCheck {
  const errors: string[] = [];
  const doc = raw as Partial<CourseDoc> | null;
  if (!doc || typeof doc !== "object") return { ok: false, errors: ["course must be an object"] };
  if (!text(doc.version, 80) || String(doc.version).includes('"')) errors.push("version must be a non-empty string");
  if (!Array.isArray(doc.units) || doc.units.length === 0) errors.push("units must be a non-empty array");
  if (!Array.isArray(doc.lessons) || doc.lessons.length === 0) errors.push("lessons must be a non-empty array");
  if (!Array.isArray(doc.comingSoon)) errors.push("comingSoon must be an array");
  if (errors.length) return { ok: false, errors };

  const unitIds = new Set<string>();
  for (const u of doc.units!) {
    if (!u || !ID.test(String(u.id)) || !text(u.title, 120) || !text(u.sub, 200)) errors.push(`unit ${String(u?.id)}: id, title and sub are required`);
    else if (unitIds.has(u.id)) errors.push(`unit ${u.id}: duplicate id`);
    else unitIds.add(u.id);
  }
  const lessonIds = new Set<string>();
  const unitOrder = [...unitIds];
  let lastUnit = -1;
  for (const l of doc.lessons!) {
    const id = String(l?.id);
    if (!l || !ID.test(id)) {
      errors.push(`lesson ${id}: invalid id`);
      continue;
    }
    if (lessonIds.has(id)) errors.push(`lesson ${id}: duplicate id`);
    lessonIds.add(id);
    if (!unitIds.has(l.unit)) errors.push(`lesson ${id}: unknown unit ${String(l.unit)}`);
    const u = unitOrder.indexOf(l.unit);
    if (u < lastUnit) errors.push(`lesson ${id}: units must appear in order`);
    lastUnit = Math.max(lastUnit, u);
    if (!text(l.title, 120) || !text(l.sub, 200)) errors.push(`lesson ${id}: title and sub are required`);
    if (!int(l.minutes, 1, 60) || !int(l.xp, 1, 100)) errors.push(`lesson ${id}: minutes 1–60 and xp 1–100`);
    if (id === "meet") continue; // the product tour has no script; the apps play it themselves
    checkSteps(id, l.steps, errors);
  }
  for (const u of unitIds) if (!doc.lessons!.some((l) => l.unit === u)) errors.push(`unit ${u}: has no lessons`);
  for (const c of doc.comingSoon!) {
    if (!c || !ID.test(String(c.id)) || !text(c.title, 120) || !text(c.sub, 200)) errors.push(`coming soon ${String(c?.id)}: id, title and sub are required`);
    else if (lessonIds.has(c.id)) errors.push(`coming soon ${c.id}: clashes with a lesson id`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, doc: doc as CourseDoc };
}
