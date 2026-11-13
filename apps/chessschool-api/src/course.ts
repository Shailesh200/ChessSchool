import { LESSONS } from "@chessschool/chess";
import { PATH, UNITS, copy, type Course } from "@chessschool/design";

/** Written into cs_course on startup. Apps read this row; they do not ship the lesson script. */
export function courseDocument(): Course {
  return {
    units: UNITS.map((id) => ({ id, title: copy.units[id].title, sub: copy.units[id].sub })),
    lessons: PATH.map((n) => ({
      id: n.id,
      unit: n.unit,
      title: copy.path[n.id]?.title ?? n.id,
      sub: copy.path[n.id]?.sub ?? "",
      minutes: n.minutes,
      xp: n.xp,
      steps: LESSONS[n.id]?.steps ?? [],
    })),
    comingSoon: copy.comingSoon,
  };
}
