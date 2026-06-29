// Web bot entry: pure logic comes from @chess-school/core; getBotMove wires the
// web Stockfish (Web Worker + /engine WASM) as the engine adapter.
import { getBotMove as coreBotMove, type EngineAdapter } from "@chess-school/core";
import type { BotConfig, MoveInput } from "@chess-school/core";

export { chooseMove, eloToConfig } from "@chess-school/core";
export type { BotConfig } from "@chess-school/core";

const webStockfish: EngineAdapter = async (fen, elo) => {
  const { stockfishMove } = await import("./stockfish");
  return stockfishMove(fen, elo);
};

/** Best move for the web bot (real Stockfish ≥800, JS fallback otherwise). */
export function getBotMove(fen: string, config: BotConfig, seed = 0.5): Promise<MoveInput | null> {
  return coreBotMove(fen, config, seed, webStockfish);
}
