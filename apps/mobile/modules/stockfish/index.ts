import { NativeModule, requireNativeModule } from "expo";

// Events emitted by the native engine (one UCI output line at a time).
type StockfishEvents = {
  "stockfish-output": (event: { line: string }) => void;
};

declare class StockfishNativeModule extends NativeModule<StockfishEvents> {
  /** Boot the engine + UCI loop on a background thread. */
  start(): void;
  /** Send a raw UCI command (e.g. "position fen …", "go movetime 700"). */
  sendCommand(cmd: string): void;
  /** True once the engine has booted. */
  isReady(): boolean;
}

// Resolves only in a dev build that includes this module; throws in Expo Go / web
// (callers in src/stockfish.ts guard the require and fall back to the JS engine).
export default requireNativeModule<StockfishNativeModule>("Stockfish");
