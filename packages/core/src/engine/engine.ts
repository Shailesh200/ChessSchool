import { Chess } from "chess.js";
import type {
  Color,
  GameStatus,
  MoveInput,
  Square,
  VerboseMove,
} from "../types/chess";

/**
 * ChessEngine — a thin, intention-revealing wrapper over chess.js.
 *
 * The rest of the app talks to this domain object, never to chess.js directly,
 * so the underlying rules engine can be swapped or extended without touching UI.
 */
export class ChessEngine {
  private game: Chess;

  constructor(fen?: string) {
    this.game = fen ? new Chess(fen) : new Chess();
  }

  static fromPgn(pgn: string): ChessEngine {
    const e = new ChessEngine();
    e.game.loadPgn(pgn);
    return e;
  }

  clone(): ChessEngine {
    return new ChessEngine(this.fen());
  }

  fen(): string {
    return this.game.fen();
  }

  pgn(): string {
    return this.game.pgn();
  }

  turn(): Color {
    return this.game.turn();
  }

  /** Attempt a move. Returns the resulting verbose move, or null if illegal. */
  move(input: MoveInput | string): VerboseMove | null {
    try {
      const result = this.game.move(input as never);
      return result as unknown as VerboseMove;
    } catch {
      return null;
    }
  }

  undo(): VerboseMove | null {
    const m = this.game.undo();
    return (m as unknown as VerboseMove) ?? null;
  }

  /** All legal moves, optionally from a given square. */
  legalMoves(from?: Square): VerboseMove[] {
    const opts = from ? { square: from as never, verbose: true } : { verbose: true };
    return this.game.moves(opts as never) as unknown as VerboseMove[];
  }

  /** Legal target squares from a square — used to render move dots. */
  legalTargets(from: Square): Square[] {
    return this.legalMoves(from).map((m) => m.to);
  }

  history(): VerboseMove[] {
    return this.game.history({ verbose: true }) as unknown as VerboseMove[];
  }

  isGameOver(): boolean {
    return this.game.isGameOver();
  }

  inCheck(): boolean {
    return this.game.inCheck();
  }

  status(): GameStatus {
    if (this.game.isCheckmate()) return "checkmate";
    if (this.game.isStalemate()) return "stalemate";
    if (this.game.isInsufficientMaterial()) return "insufficient";
    if (this.game.isThreefoldRepetition()) return "threefold";
    if (this.game.isDraw()) return "draw";
    if (this.game.inCheck()) return "check";
    return "playing";
  }

  /** Square of the king for a color — used for the "in check" glow. */
  kingSquare(color: Color): Square | null {
    const board = this.game.board();
    for (let r = 0; r < board.length; r++) {
      const row = board[r];
      if (!row) continue;
      for (let f = 0; f < row.length; f++) {
        const cell = row[f];
        if (cell && cell.type === "k" && cell.color === color) {
          return cell.square as Square;
        }
      }
    }
    return null;
  }

  reset(): void {
    this.game.reset();
  }

  load(fen: string): boolean {
    try {
      this.game.load(fen);
      return true;
    } catch {
      return false;
    }
  }
}
