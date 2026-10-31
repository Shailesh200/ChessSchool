/** Course-map nodes and class rows for the premium illustrated path. */

export type PathNodeKind = "done" | "current" | "locked" | "exam";
export type PathGlyph = "check" | "play" | "lock" | "flag";

export type CoursePathNode = {
  id: string;
  title: string;
  caption: string;
  kind: PathNodeKind;
  side: "l" | "r";
  href: string | null;
  glyph: PathGlyph;
  filled: boolean;
};

export type CoursePath = {
  overline: string;
  title: string;
  done: number;
  total: number;
  ringPercent: number;
  coachLine: string;
  nodes: CoursePathNode[];
};

type PathClass = { id: string; title: string; examId?: string };
type PathSemester = { id: string; title: string; stage: string; classes: PathClass[] };
type PathStage = { id: string; name: string };

export function buildPremiumCoursePath(input: {
  stages: PathStage[];
  semesters: PathSemester[];
  graduatedIds: readonly string[];
  unlocked: (classId: string) => boolean;
}): CoursePath | null {
  const graduated = new Set(input.graduatedIds);
  const classesIn = (stageId: string) =>
    input.semesters.filter((sem) => sem.stage === stageId).flatMap((sem) => sem.classes);

  const open = input.stages.findIndex((stage) => {
    const classes = classesIn(stage.id);
    return classes.length > 0 && classes.some((cls) => !graduated.has(cls.id));
  });
  const index = open >= 0 ? open : Math.max(0, input.stages.findIndex((stage) => classesIn(stage.id).length > 0));
  const stage = input.stages[index];
  if (!stage) return null;

  const stageClasses = classesIn(stage.id);
  const semesters = input.semesters.filter((sem) => sem.stage === stage.id && sem.classes.length > 0);
  const semester =
    semesters.find((sem) => sem.classes.some((cls) => input.unlocked(cls.id) && !graduated.has(cls.id))) ??
    semesters[0];
  if (!semester) return null;

  let seenCurrent = false;
  const nodes: CoursePathNode[] = semester.classes.map((cls, i) => {
    let kind: PathNodeKind = "locked";
    if (graduated.has(cls.id)) kind = "done";
    else if (input.unlocked(cls.id) && !seenCurrent) {
      kind = "current";
      seenCurrent = true;
    }
    const caption =
      kind === "done" ? `Class ${i + 1} · done` : kind === "current" ? `Class ${i + 1} · up next` : `Class ${i + 1} · locked`;
    return {
      id: cls.id,
      title: cls.title,
      caption,
      kind,
      side: i % 2 === 0 ? "l" : "r",
      href: kind === "locked" ? null : `/class/${cls.id}`,
      glyph: kind === "done" ? "check" : kind === "current" ? "play" : "lock",
      filled: kind === "current",
    };
  });

  const examClass = semester.classes.find((cls) => cls.examId);
  if (examClass?.examId) {
    const examLocked = semester.classes.some((cls) => !graduated.has(cls.id));
    nodes.push({
      id: `stage-test-${stage.id}`,
      title: "Stage test",
      caption: examLocked ? "Locked" : "Ready",
      kind: "exam",
      side: nodes.length % 2 === 0 ? "l" : "r",
      href: examLocked ? null : `/class/${examClass.id}/exam`,
      glyph: "flag",
      filled: false,
    });
  }

  const current = nodes.find((node) => node.kind === "current");
  const done = stageClasses.filter((cls) => graduated.has(cls.id)).length;
  const total = stageClasses.length;
  return {
    overline: `Stage ${index + 1} · ${stage.name}`,
    title: semester.title,
    done,
    total,
    ringPercent: total === 0 ? 0 : Math.round((done / total) * 100),
    coachLine: current ? `${current.title} next. You've got this!` : "Your path is ready when you are.",
    nodes,
  };
}

export type ClassRowTone = "done" | "current" | "locked" | "open";

/** Lesson row chrome. Locked copy names the lesson that still has to be finished. */
export function classPathRow(input: {
  tone: ClassRowTone;
  index: number;
  mastery: number;
  activeIndex: number;
}): { tileClass: string; glyph: PathGlyph; caption: string; current: boolean; filled: boolean } {
  if (input.tone === "done") {
    return {
      tileClass: "tile-done",
      glyph: "check",
      caption: `Done · ${Math.round(input.mastery * 100)}%`,
      current: false,
      filled: false,
    };
  }
  if (input.tone === "current") {
    return {
      tileClass: "cs-row__tile--accent",
      glyph: "play",
      caption: "Up next",
      current: true,
      filled: false,
    };
  }
  if (input.tone === "locked") {
    const after = input.activeIndex >= 0 ? input.activeIndex + 1 : Math.max(1, input.index);
    return {
      tileClass: "tile-lock",
      glyph: "lock",
      caption: `Unlocks after lesson ${after}`,
      current: false,
      filled: false,
    };
  }
  return {
    tileClass: "cs-row__tile--accent",
    glyph: "play",
    caption: "Practice",
    current: false,
    filled: false,
  };
}

/** Class exam chip. Six puzzles pass at 5, because the mark is ceil(steps * 0.67). */
export function classExamCaption(puzzleTotal: number | null): string {
  if (puzzleTotal == null || puzzleTotal <= 0) return "Pass to graduate";
  return `${puzzleTotal} puzzles · pass with ${Math.ceil(puzzleTotal * 0.67)}`;
}

/** Interactive exam steps stored on the lesson row. */
export function countExamPuzzles(stepsJson: string | null | undefined): number | null {
  if (!stepsJson) return null;
  try {
    const steps = JSON.parse(stepsJson) as { kind?: string }[];
    if (!Array.isArray(steps)) return null;
    const total = steps.filter((step) => step.kind === "move" || step.kind === "quiz").length;
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}
