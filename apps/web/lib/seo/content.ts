/** Shared SEO copy + internal link targets (server-safe). */

export type FaqItem = { question: string; answer: string };

export type CurriculumLink = {
  href: string;
  title: string;
  description: string;
  emoji: string;
};

export const SEO_FAQ: FaqItem[] = [
  {
    question: "Is ChessSchool free to learn chess?",
    answer:
      "Yes. ChessSchool is a free online chess school. You can play lessons, puzzles, and bot games without paying. Create a free account to save progress across devices.",
  },
  {
    question: "How do I learn chess as a complete beginner?",
    answer:
      "Start with Pre-School — board setup, how pieces move, check, checkmate, and chess notation (like Nf3 and Qd5). Then graduate into Foundations, openings, tactics, and endgames at your own pace.",
  },
  {
    question: "What makes ChessSchool different from other chess apps?",
    answer:
      "ChessSchool is structured like a real school: semesters, classes, lessons, and exams — not an endless puzzle feed. Every position is FEN-verified, with coach narration and a clear path from beginner to advanced.",
  },
  {
    question: "Can I play chess online with a friend?",
    answer:
      "Yes. Create a live game from the Play tab, share the invite link, and your friend joins as Black. Games support clocks and work in the browser — no download required.",
  },
  {
    question: "Do I need to download an app?",
    answer:
      "No. ChessSchool runs in your browser as a progressive web app (PWA). You can install it to your home screen for offline access. Android and iOS apps are also available.",
  },
  {
    question: "How long does it take to learn chess basics?",
    answer:
      "Most beginners finish Pre-School in a few sessions (board, pieces, and rules). The placement test then recommends Elementary, Middle, or High School based on your puzzle score.",
  },
];

export const BEGINNER_FAQ: FaqItem[] = SEO_FAQ.filter((_, i) => [0, 1, 2, 5].includes(i));

/** High-value internal links for crawlers and new visitors. */
export const CURRICULUM_HIGHLIGHTS: CurriculumLink[] = [
  {
    href: "/class/class-pre-board",
    title: "Pre-School: The Chess Board",
    description: "Squares, setup, files, ranks, and coordinates — perfect if you've never played.",
    emoji: "🗺️",
  },
  {
    href: "/class/class-pieces",
    title: "Foundations: Piece Movement",
    description: "Pawns, knights, rooks, bishops, queen, king — and your first checkmates.",
    emoji: "♟️",
  },
  {
    href: "/class/class-principles",
    title: "Opening Principles",
    description: "Develop pieces, control the centre, and castle safely every game.",
    emoji: "🚀",
  },
  {
    href: "/class/class-tactics",
    title: "Tactics Lab",
    description: "Forks, pins, and combinations — win material with real-game puzzles.",
    emoji: "🍴",
  },
  {
    href: "/class/class-endgame",
    title: "Essential Endgames",
    description: "Promotion, opposition, and converting a winning advantage.",
    emoji: "🤴",
  },
  {
    href: "/play",
    title: "Play Chess Online",
    description: "Adaptive bots by rating, pass & play, and live share-link multiplayer.",
    emoji: "🏆",
  },
];

export const LEARN_CHESS_SECTIONS = [
  {
    id: "structured",
    title: "A real chess school — not just puzzles",
    body:
      "ChessSchool organizes thousands of lessons into semesters and classes. You graduate by mastering milestones, pass class exams, and unlock the next stage — from Pre-School through Master level. Whether you search for a chess academy, chess classes, or free chess lessons online, the curriculum is built for steady improvement.",
  },
  {
    id: "practice",
    title: "Learn, then play — every day",
    body:
      "Each lesson mixes coach tips, board demonstrations, and interactive puzzles verified with chess.js. After studying, play adaptive bots matched to your ELO, review saved games, and challenge friends with a share link. Daily homework and spaced review keep tactics fresh.",
  },
  {
    id: "free",
    title: "Free chess lessons for every level",
    body:
      "From chess for beginners to opening theory and immortal games, everything is free in the browser. Take the placement test to skip ahead if you already know the rules, or start from Pre-School if you're brand new.",
  },
] as const;

export const BEGINNER_INTRO =
  "Never played chess before? ChessSchool Pre-School walks you through the board, every piece, check, checkmate, castling, and promotion — with interactive puzzles so you learn by doing, not memorizing. When you're ready, the placement test finds the right starting class.";
