/**
 * Ordered Pre-School topics — index must never decrease along prerequisite chains.
 * Owner: en passant after castling; clocks conceptual only (no timed play in Pre-School).
 */
export const PRESCHOOL_TOPICS = [
  "board",
  "pieces-intro",
  "move-pawn",
  "move-knight",
  "move-rook",
  "move-bishop",
  "move-queen",
  "move-king",
  "capture",
  "blocking",
  "promotion",
  "castling",
  "en-passant",
  "check",
  "escape-check",
  "checkmate",
  "stalemate",
  "draw",
  "material-points",
  "game-goal",
  "clocks",
  "notation",
];

/** @type {Record<string, string>} lesson id → preschoolTopic */
export const PRESCHOOL_LESSON_TOPICS = {
  "pre-board-intro": "board",
  "pre-board-setup": "board",
  "pre-square-d5": "board",
  "pre-square-e4": "board",
  "pre-pieces-roster": "pieces-intro",
  "pre-pieces-queen": "pieces-intro",
  "pre-pieces-king": "pieces-intro",
  "pre-pawn-basics": "move-pawn",
  "pre-pawn-quiz": "move-pawn",
  "pre-moves-e4": "move-pawn",
  "pre-knight-basics": "move-knight",
  "pre-knight-quiz": "move-knight",
  "pre-rook-basics": "move-rook",
  "pre-rook-quiz": "move-rook",
  "pre-bishop-basics": "move-bishop",
  "pre-bishop-quiz": "move-bishop",
  "pre-queen-moves": "move-queen",
  "pre-queen-slide-quiz": "move-queen",
  "pre-king-moves": "move-king",
  "pre-king-quiz": "move-king",
  "pre-capture-intro": "capture",
  "pre-rules-blocking": "blocking",
  "pre-rules-promotion": "promotion",
  "pre-rules-promotion-quiz": "promotion",
  "pre-moves-promotion": "promotion",
  "pre-rules-castling": "castling",
  "pre-rules-castling-quiz": "castling",
  "pre-moves-castling": "castling",
  "pre-rules-en-passant": "en-passant",
  "pre-rules-en-passant-quiz": "en-passant",
  "pre-moves-en-passant": "en-passant",
  "pre-rules-check-intro": "check",
  "pre-rules-check-quiz": "check",
  "pre-rules-escape-intro": "escape-check",
  "pre-moves-escape-check": "escape-check",
  "pre-rules-checkmate-intro": "checkmate",
  "pre-rules-checkmate-quiz": "checkmate",
  "pre-rules-stalemate": "stalemate",
  "pre-rules-draw": "draw",
  "pre-material-intro": "material-points",
  "pre-material-quiz": "material-points",
  "pre-game-goal": "game-goal",
  "pre-game-clocks": "clocks",
  "pre-notation-files": "notation",
  "pre-notation-e-file": "notation",
  "pre-notation-ranks": "notation",
  "pre-notation-d6": "notation",
  "pre-notation-piece-letters": "notation",
  "pre-notation-pawn-e4": "notation",
  "pre-notation-pawn-capture": "notation",
  "pre-notation-watch": "notation",
  "pre-notation-read-d6": "notation",
  "pre-notation-practice": "notation",
};

export function topicIndex(topic) {
  const i = PRESCHOOL_TOPICS.indexOf(topic);
  return i === -1 ? -1 : i;
}

export function preschoolTopicForLesson(lessonId, tag) {
  if (PRESCHOOL_LESSON_TOPICS[lessonId]) return PRESCHOOL_LESSON_TOPICS[lessonId];
  if (tag === "preschool") return null;
  return undefined;
}
