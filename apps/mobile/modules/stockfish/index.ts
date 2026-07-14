import { NativeModule, requireOptionalNativeModule } from "expo";

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

// Apple-only module today — optional so Android / Expo Go never throw on import.
const Stockfish = requireOptionalNativeModule<StockfishNativeModule>("Stockfish");

export default Stockfish;
