import { compilePuzzleSteps } from "./compile-lesson.mjs";
import {
  CONCEPT_GROUPS,
  CONCEPT_TUTORIALS,
  STAGE_BANDS,
} from "./concepts.mjs";

const LEVELS = [
  "Basics",
  "Building Up",
  "Sharper",
  "Tougher",
  "Advanced",
  "Tricky",
  "Expert",
  "Mastery",
];

/**
 * Build semesters / classes / lessons from bank buckets.
 * @param {Map<string, import('./bank.mjs').BankPuzzle[]>} buckets
 * @param {{ perClass?: number, targetTotal?: number }} [opts]
 */
export function buildCurriculumFromBuckets(buckets, opts = {}) {
  const PER_CLASS = opts.perClass ?? 18;
  const TARGET_TOTAL = opts.targetTotal ?? 16000;

  const semesters = [];
  const classes = [];
  const lessons = [];
  let total = 0;
  let sortClass = 0;

  for (const g of CONCEPT_GROUPS) {
    for (const st of STAGE_BANDS) {
      const arr = buckets.get(`${st.id}:${g.id}`);
      if (!arr || arr.length < 3) continue;

      const semId = `pz-${st.id}-${g.id}`;
      semesters.push({
        id: semId,
        title: `${st.title}: ${g.label}`,
        blurb: `${g.label} from real games`,
        color: g.color,
        stage: st.id,
        sortOrder: st.order * 10 + CONCEPT_GROUPS.indexOf(g),
      });

      const made = [];
      for (const pz of arr) {
        const compiled = compilePuzzleSteps(pz);
        if ("error" in compiled) continue;
        made.push({ pz, steps: compiled.steps });
        if (made.length >= TARGET_TOTAL) break;
      }

      for (let ci = 0; ci * PER_CLASS < made.length; ci++) {
        const slice = made.slice(ci * PER_CLASS, (ci + 1) * PER_CLASS);
        if (!slice.length) break;
        const classId = `${semId}-c${ci + 1}`;
        const difficulty = Math.min(6, st.order + 1 + Math.floor(ci / 3));
        const level = LEVELS[ci] ?? `Set ${ci + 1}`;
        const lo = slice[0].pz.rating;
        const hi = slice[slice.length - 1].pz.rating;
        const singular = g.label.replace(/s$/, "");
        classes.push({
          id: classId,
          semesterId: semId,
          title: `${singular}: ${level}`,
          emoji: g.emoji,
          blurb: `${slice.length} puzzles · ${lo}–${hi}`,
          difficulty,
          sortOrder: sortClass++,
        });

        lessons.push({
          id: `${classId}-tutorial`,
          classId,
          title: `${g.label}: the idea`,
          subtitle: "Tutorial",
          emoji: "🎓",
          tag: g.id,
          xp: 15,
          isExam: 0,
          prerequisites: "[]",
          sortOrder: 0,
          steps: JSON.stringify([
            {
              id: "t",
              kind: "info",
              coach: CONCEPT_TUTORIALS[g.id],
              fen: slice[0].steps[0].fen,
            },
          ]),
        });

        slice.forEach(({ pz, steps }, li) => {
          lessons.push({
            id: `${classId}-l${li + 1}`,
            classId,
            title: `${g.label} · ${pz.rating}`,
            subtitle: `${Math.ceil(steps.length)} move${steps.length > 1 ? "s" : ""}`,
            emoji: g.emoji,
            tag: g.id,
            xp: 10 + steps.length * 4,
            isExam: 0,
            prerequisites: "[]",
            steps: JSON.stringify(steps),
            sortOrder: li + 1,
          });
          total++;
        });
      }
    }
  }

  return { semesters, classes, lessons, puzzleCount: total };
}
