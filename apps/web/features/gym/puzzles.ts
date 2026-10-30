export type GymPuzzle = {
  id: string;
  title: string;
  skill: "Forks" | "Pins" | "Skewers" | "Mates" | "Endgames";
  level: "Easy" | "Medium" | "Hard";
  lessonId: string;
  fen: string;
  /** Design fixture solved flag. Live status comes from lesson mastery. */
  fixtureDone: boolean;
};

export const GYM_PUZZLES: GymPuzzle[] = [
  {
    id: "fork-kq",
    title: "Fork the king and queen",
    skill: "Forks",
    level: "Easy",
    lessonId: "fork-master",
    fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
    fixtureDone: true,
  },
  {
    id: "pin-knight",
    title: "Pin the knight",
    skill: "Pins",
    level: "Easy",
    lessonId: "pin-it",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3",
    fixtureDone: false,
  },
  {
    id: "skewer-rook",
    title: "Skewer the rook",
    skill: "Skewers",
    level: "Medium",
    lessonId: "skewer-it",
    fen: "q7/8/8/k7/8/8/8/1R4K1 w - - 0 1",
    fixtureDone: true,
  },
  {
    id: "back-rank",
    title: "Back-rank mate in one",
    skill: "Mates",
    level: "Easy",
    lessonId: "mate-in-one",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "knight-c7",
    title: "Knight fork on c7",
    skill: "Forks",
    level: "Medium",
    lessonId: "knight-hops",
    fen: "k7/8/4p3/8/3N4/8/8/7K w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "opposition",
    title: "Opposition",
    skill: "Endgames",
    level: "Hard",
    lessonId: "endgame-opposition",
    fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "win-queen",
    title: "Win the queen with a skewer",
    skill: "Skewers",
    level: "Hard",
    lessonId: "skewer-it",
    fen: "3q2k1/8/8/8/8/8/1B6/4K3 w - - 0 1",
    fixtureDone: false,
  },
  {
    id: "smothered",
    title: "Smothered mate",
    skill: "Mates",
    level: "Hard",
    lessonId: "endgame-qmate",
    fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1",
    fixtureDone: false,
  },
];

export const DAILY_PUZZLE = GYM_PUZZLES[0]!;
