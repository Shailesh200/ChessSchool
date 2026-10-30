import { dueLessonIds } from "@chess-school/progression";
import { EXAM_PASS_RATIO } from "@/classExam";

export type CourseMapPhase = "loading" | "empty" | "error" | "offline" | "ready";

export function courseMapPhase(input: {
  online: boolean;
  loading: boolean;
  failed: boolean;
  hasPath: boolean;
}): CourseMapPhase {
  if (!input.online) return "offline";
  if (input.loading && !input.hasPath) return "loading";
  if (input.failed && !input.hasPath) return "error";
  if (!input.hasPath) return "empty";
  return "ready";
}

export function campusHasPath(stages: { semesters: { classes: unknown[] }[] }[]): boolean {
  return stages.some((stage) => stage.semesters.some((sem) => sem.classes.length > 0));
}

export type MapClass = { id: string; title: string; graduated: boolean; unlocked: boolean };
export type MapSemester = { id: string; title: string; classes: MapClass[] };
export type MapStage = {
  id: string;
  name: string;
  locked: boolean;
  cleared: boolean;
  optional?: boolean;
  semesters: MapSemester[];
  doneClasses: number;
  totalClasses: number;
};

export type MapNodeKind = "done" | "current" | "locked" | "exam";

export type CourseMapNode = {
  id: string;
  title: string;
  caption: string;
  side: "l" | "r";
  kind: MapNodeKind;
  navigable: boolean;
  href: { pathname: "/class/[id]" | "/exam/school/[stage]"; params: { id?: string; stage?: string } } | null;
};

export type CourseMapView = {
  stageId: string;
  overline: string;
  title: string;
  done: number;
  total: number;
  ringPercent: number;
  nodes: CourseMapNode[];
  coachLine: string;
};

export function mapCoachLine(currentTitle: string | null): string {
  if (!currentTitle) return "Your path is ready when you are.";
  return `${currentTitle} next. You've got this!`;
}

/** Zigzag for the active semester, plus the stage test. Gym is not a node. */
export function buildCourseMap(stages: MapStage[]): CourseMapView | null {
  if (!campusHasPath(stages)) return null;
  const open = stages.findIndex((stage) => !stage.locked && !stage.cleared);
  const unlocked = stages.findIndex((stage) => !stage.locked);
  const index = open >= 0 ? open : unlocked >= 0 ? unlocked : 0;
  const stage = stages[index];
  if (!stage) return null;
  const semester =
    stage.semesters.find((sem) => sem.classes.some((cls) => cls.unlocked && !cls.graduated)) ??
    stage.semesters.find((sem) => sem.classes.length > 0);
  if (!semester || semester.classes.length === 0) return null;

  let seenCurrent = false;
  const nodes: CourseMapNode[] = semester.classes.map((cls, i) => {
    let kind: MapNodeKind = "locked";
    if (cls.graduated) kind = "done";
    else if (cls.unlocked && !seenCurrent) {
      kind = "current";
      seenCurrent = true;
    }
    const caption =
      kind === "done" ? `Class ${i + 1} · done` : kind === "current" ? `Class ${i + 1} · up next` : `Class ${i + 1} · locked`;
    return {
      id: cls.id,
      title: cls.title,
      caption,
      side: i % 2 === 0 ? "l" : "r",
      kind,
      navigable: kind === "done" || kind === "current",
      href:
        kind === "done" || kind === "current"
          ? { pathname: "/class/[id]", params: { id: cls.id } }
          : null,
    };
  });

  const examLocked = semester.classes.some((cls) => !cls.graduated) || stage.locked;
  nodes.push({
    id: `school-exam-${stage.id}`,
    title: "Stage test",
    caption: examLocked ? "Locked" : "Ready",
    side: nodes.length % 2 === 0 ? "l" : "r",
    kind: "exam",
    navigable: !examLocked,
    href: examLocked ? null : { pathname: "/exam/school/[stage]", params: { stage: stage.id } },
  });

  const current = nodes.find((node) => node.kind === "current");
  const total = stage.totalClasses;
  const done = stage.doneClasses;
  return {
    stageId: stage.id,
    overline: `Stage ${index + 1} · ${stage.name}`,
    title: semester.title,
    done,
    total,
    ringPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    nodes,
    coachLine: mapCoachLine(current?.title ?? null),
  };
}

export type OfflineRow = {
  id: string;
  title: string;
  caption: string;
  ready: boolean;
  href: string | null;
};

export function offlineLearnRows(input: {
  resumeTitle?: string | null;
  resumeLessonId?: string | null;
  dueCount: number;
  lockedTitles: string[];
}): { ready: OfflineRow[]; needsInternet: OfflineRow[] } {
  const ready: OfflineRow[] = [];
  if (input.resumeTitle && input.resumeLessonId) {
    ready.push({
      id: input.resumeLessonId,
      title: input.resumeTitle,
      caption: "Ready offline",
      ready: true,
      href: `/lesson/${input.resumeLessonId}`,
    });
  }
  if (input.dueCount > 0) {
    ready.push({
      id: "daily-review",
      title: "Daily review",
      caption: `${input.dueCount} card${input.dueCount === 1 ? "" : "s"} ready offline`,
      ready: true,
      href: "/review/queue",
    });
  }
  const needsInternet = input.lockedTitles.slice(0, 4).map((title, i) => ({
    id: `locked-${i}`,
    title,
    caption: "Needs internet",
    ready: false,
    href: null,
  }));
  return { ready, needsInternet };
}

type LessonRec = { mastery: number; attempts: number; lastSeen: number; dueAt: number };

export function reviewDueCount(lessons: unknown, now = Date.now()): number {
  return dueLessonIds(lessonRecords(lessons), now).length;
}

export function reviewTabBadge(count: number): { visible: boolean; label: string; accessibilityLabel: string } {
  if (!Number.isFinite(count) || count <= 0) {
    return { visible: false, label: "", accessibilityLabel: "Review" };
  }
  const n = Math.floor(count);
  const label = n > 99 ? "99+" : String(n);
  return { visible: true, label, accessibilityLabel: `Review, ${n} due` };
}

/** Learn / Play / Review / Profile. Gym and class routes stay on Learn. */
export function premiumTabActive(pathname: string, routeName: string, previewId = ""): boolean {
  if (pathname.includes("ace-preview")) {
    const reviewShot = previewId.startsWith("20") || previewId.startsWith("10");
    if (routeName === "review") return reviewShot;
    if (routeName === "academy") return !reviewShot;
    return false;
  }
  if (routeName === "academy") {
    return (
      pathname.includes("academy") ||
      pathname === "/" ||
      pathname.includes("/class/") ||
      pathname.includes("/lesson/") ||
      pathname.includes("/gym")
    );
  }
  if (routeName === "play") return pathname.includes("/(tabs)/play") || pathname === "/play";
  if (routeName === "review") {
    return (
      pathname.includes("/(tabs)/review") ||
      pathname.includes("/replay") ||
      pathname.includes("/review/queue") ||
      pathname.includes("/practice/mistakes")
    );
  }
  if (routeName === "profile") return pathname.includes("/(tabs)/profile");
  return false;
}

export const PREMIUM_TAB_LABELS = ["Learn", "Play", "Review", "Profile"] as const;

export const NEEDS_PRACTICE_BELOW = 0.6;

export type ReviewSkill = {
  id: string;
  title: string;
  mastery: number;
  needsPractice: boolean;
};

function lessonRecords(lessons: unknown): Record<string, LessonRec> {
  if (!lessons || typeof lessons !== "object") return {};
  const clean: Record<string, LessonRec> = {};
  for (const [id, rec] of Object.entries(lessons as Record<string, unknown>)) {
    if (!rec || typeof rec !== "object") continue;
    const row = rec as Partial<LessonRec>;
    if (typeof row.mastery !== "number" || typeof row.dueAt !== "number") continue;
    clean[id] = {
      mastery: row.mastery,
      dueAt: row.dueAt,
      attempts: typeof row.attempts === "number" ? row.attempts : 0,
      lastSeen: typeof row.lastSeen === "number" ? row.lastSeen : 0,
    };
  }
  return clean;
}

export function reviewSkills(
  lessons: unknown,
  titles: Record<string, string>,
  now = Date.now(),
): ReviewSkill[] {
  const clean = lessonRecords(lessons);
  return dueLessonIds(clean, now).map((id) => {
    const mastery = clean[id]?.mastery ?? 0;
    const titled = titles[id]?.trim();
    return {
      id,
      title: titled && titled.length > 0 ? titled : id.replace(/[-_]/g, " "),
      mastery,
      needsPractice: mastery < NEEDS_PRACTICE_BELOW,
    };
  });
}

export function reviewSummary(skills: ReviewSkill[]): { onTrack: number; needsPractice: number; due: number } {
  const needsPractice = skills.filter((skill) => skill.needsPractice).length;
  return { onTrack: skills.length - needsPractice, needsPractice, due: skills.length };
}

export function startReviewTarget(input: { mistakeCount: number; firstDueId: string | null }): {
  pathname: "/practice/mistakes" | "/lesson/[id]";
  id?: string;
} | null {
  if (input.mistakeCount > 0) return { pathname: "/practice/mistakes" };
  if (input.firstDueId) return { pathname: "/lesson/[id]", id: input.firstDueId };
  return null;
}

/** Pass mark is ceil(steps × 0.67). Six puzzles need five. */
export function examPassMark(total: number, ratio = EXAM_PASS_RATIO): number {
  if (total <= 0) return 0;
  return Math.ceil(total * ratio);
}

export function examPipState(stepIndex: number, total: number): Array<"done" | "current" | "todo"> {
  return Array.from({ length: Math.max(0, total) }, (_, i) => (i < stepIndex ? "done" : i === stepIndex ? "current" : "todo"));
}

export type ClassRowTone = "done" | "current" | "locked" | "exam";

export function classDetailCaption(input: {
  tone: ClassRowTone;
  index: number;
  mastery: number;
  activeIndex: number;
}): string {
  if (input.tone === "done") return `Done · ${Math.round(input.mastery * 100)}%`;
  if (input.tone === "current") return "Up next";
  if (input.tone === "exam") return "Pass to graduate";
  const after = input.activeIndex >= 0 ? input.activeIndex + 1 : input.index;
  return `Unlocks after lesson ${after}`;
}

export type GymSkill = "All" | "Forks" | "Pins" | "Skewers" | "Mates" | "Endgames";
export type GymLevel = "All" | "Easy" | "Medium" | "Hard";

export function gymSkillOf(title: string, tag?: string | null): Exclude<GymSkill, "All"> | "All" {
  const hay = `${title} ${tag ?? ""}`.toLowerCase();
  if (hay.includes("fork")) return "Forks";
  if (hay.includes("pin")) return "Pins";
  if (hay.includes("skewer")) return "Skewers";
  if (hay.includes("mate")) return "Mates";
  if (hay.includes("endgame") || hay.includes("opposition") || hay.includes("pawn")) return "Endgames";
  return "All";
}

export function gymLevelOf(title: string): Exclude<GymLevel, "All"> {
  const hay = title.toLowerCase();
  if (hay.includes("hard") || hay.includes("opposition") || hay.includes("smother")) return "Hard";
  if (hay.includes("medium") || hay.includes("skewer")) return "Medium";
  return "Easy";
}

export type GymPuzzle = { id: string; title: string; skill: ReturnType<typeof gymSkillOf>; level: ReturnType<typeof gymLevelOf>; solved: boolean };

export function filterGymPuzzles(
  items: GymPuzzle[],
  query: { q: string; skill: GymSkill; level: GymLevel },
): GymPuzzle[] {
  const q = query.q.trim().toLowerCase();
  return items.filter((item) => {
    if (query.skill !== "All" && item.skill !== query.skill) return false;
    if (query.level !== "All" && item.level !== query.level) return false;
    if (q && !item.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

export type StatusSheetKind = "empty" | "error" | "offline";

export function statusSheetCopy(kind: StatusSheetKind): { title: string; body: string; primary: string; secondary: string } {
  if (kind === "empty") {
    return {
      title: "Nothing here yet",
      body: "Solve a puzzle and it will show up here, so you can find it again.",
      primary: "Go to the Gym",
      secondary: "Not now",
    };
  }
  if (kind === "offline") {
    return {
      title: "You're offline",
      body: "No problem. Puzzles you already opened still work. We will sync your progress when you are back online.",
      primary: "Try again",
      secondary: "Keep going offline",
    };
  }
  return {
    title: "Something went wrong",
    body: "We couldn't finish that. Your progress is safe. Try again in a moment.",
    primary: "Try again",
    secondary: "Back to Gym",
  };
}
