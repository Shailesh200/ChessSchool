/**
 * ChessSchool structure — constants / data layer (backend-swappable).
 *
 * All graduation → stage → semester → class → unit data lives here as pure
 * constants so a future backend can supply the same shapes. Logic that operates
 * on this data lives in `features/school/structure.ts`.
 */

export interface ContentUnit {
  id: string;
  title: string;
  lessonIds: string[];
}

export interface SchoolClass {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  /** flat lesson order (source of truth); `units` is optional display grouping */
  lessonIds: string[];
  examId?: string;
  difficulty?: number; // 1..5
  units?: ContentUnit[];
}

export interface Semester {
  id: string;
  title: string;
  blurb: string;
  color: string;
  stage: string; // Stage id
  classes: SchoolClass[];
}

export interface Stage {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  status: "open" | "upcoming";
}

/**
 * The full academic ladder (per the curriculum spec). Early stages are
 * populated with verified lessons; later stages are scaffolded and will be
 * filled from the content layer / backend (see README curriculum roadmap).
 */
export const STAGES: Stage[] = [
  { id: "elementary", name: "Elementary School", emoji: "🎒", blurb: "Classes 1–5 · the essentials", status: "open" },
  { id: "middle", name: "Middle School", emoji: "📐", blurb: "Classes 6–8 · tactics & endgames", status: "open" },
  { id: "high", name: "High School", emoji: "🎓", blurb: "Classes 9–12 · strategy & planning", status: "upcoming" },
  { id: "university", name: "University", emoji: "🏛️", blurb: "Classes 13–16 · deep theory", status: "upcoming" },
  { id: "master", name: "Master Program", emoji: "♛", blurb: "Classes 17–20 · the road to mastery", status: "upcoming" },
];

export const SEMESTERS: Semester[] = [
  {
    id: "sem-foundations",
    title: "Semester 1 · Foundations",
    blurb: "How the pieces move and how games end",
    color: "#5b5bd6",
    stage: "elementary",
    classes: [
      {
        id: "class-pieces",
        title: "Piece Movement",
        emoji: "♟️",
        blurb: "Pawns, rooks & knights",
        difficulty: 1,
        lessonIds: ["board-basics", "pawn-power", "rook-roads", "knight-hops"],
        examId: "exam-pieces",
      },
      {
        id: "class-checkmate",
        title: "Checks & Checkmates",
        emoji: "👑",
        blurb: "Attack the king and finish",
        difficulty: 1,
        lessonIds: ["deliver-check", "mate-in-one"],
      },
    ],
  },
  {
    id: "sem-openings",
    title: "Semester 2 · Opening School",
    blurb: "Start every game like a pro",
    color: "#0f7a55",
    stage: "elementary",
    classes: [
      {
        id: "class-principles",
        title: "Opening Principles",
        emoji: "🚀",
        blurb: "Centre, develop, castle",
        difficulty: 2,
        lessonIds: ["opening-principles"],
      },
      {
        id: "class-openings",
        title: "Famous Openings",
        emoji: "📖",
        blurb: "Italian, Ruy Lopez & Sicilian",
        difficulty: 2,
        lessonIds: ["italian-game", "ruy-lopez", "sicilian-defense"],
      },
    ],
  },
  {
    id: "sem-tactics",
    title: "Semester 3 · Tactics Lab",
    blurb: "Win material with combinations",
    color: "#cf4324",
    stage: "middle",
    classes: [
      {
        id: "class-tactics",
        title: "Tactical Motifs",
        emoji: "🍴",
        blurb: "Forks & combinations",
        difficulty: 3,
        lessonIds: ["fork-master"],
      },
      {
        id: "class-advtactics",
        title: "Advanced Tactics",
        emoji: "🎯",
        blurb: "Pins, skewers & discoveries",
        difficulty: 3,
        lessonIds: ["pin-it", "skewer-it", "discovered-attack"],
      },
    ],
  },
  {
    id: "sem-endgame",
    title: "Semester 4 · Endgame School",
    blurb: "Convert advantages into wins",
    color: "#7c5cd6",
    stage: "middle",
    classes: [
      {
        id: "class-endgame",
        title: "Essential Endgames",
        emoji: "🤴",
        blurb: "Opposition, promotion & mates",
        difficulty: 3,
        lessonIds: ["endgame-opposition", "endgame-promotion", "endgame-qmate"],
      },
    ],
  },
];
