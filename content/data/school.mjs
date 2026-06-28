// Curated school structure (data only). Imported by content/school.ts and the seeder.
export const STAGES = [
  { id: "elementary", name: "Elementary School", emoji: "🎒", blurb: "Classes 1–5 · the essentials", status: "open" },
  { id: "middle", name: "Middle School", emoji: "📐", blurb: "Classes 6–8 · tactics & endgames", status: "open" },
  { id: "high", name: "High School", emoji: "🎓", blurb: "Classes 9–12 · openings & checkmates", status: "open" },
  { id: "university", name: "University", emoji: "🏛️", blurb: "Advanced tactics & combinations", status: "open" },
  { id: "master", name: "Master Program", emoji: "♛", blurb: "Famous checkmates & immortal games", status: "open" },
];

export const SEMESTERS = [
  {
    id: "sem-foundations",
    title: "Foundations",
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
    title: "Opening School",
    blurb: "Start every game like a pro",
    color: "#0f7a55",
    stage: "middle",
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
    title: "Tactics Lab",
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
    title: "Endgame School",
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
