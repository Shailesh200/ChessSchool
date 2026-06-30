// Native Stockfish adapter.
//
// Drives a bundled native Stockfish UCI engine (the local Expo module in
// `modules/stockfish`, available only in a dev build) and exposes an
// EngineAdapter for @chess-school/core's `getBotMove`. When the native module
// isn't present (Expo Go, web export, or a failed load) every call resolves to
// `null`, so `getBotMove` transparently falls back to the in-house JS engine —
// nothing ever breaks.

export type Move = { from: string; to: string; promotion?: string };

type StockfishNative = {
  start(): void;
  isReady(): Promise<boolean> | boolean;
  sendCommand(cmd: string): void;
  addListener(event: "stockfish-output", cb: (e: { line: string }) => void): { remove(): void };
};

let native: StockfishNative | null = null;
try {
  // Optional local module — absent in Expo Go / web, so guard the require.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("../modules/stockfish");
  native = (mod?.default ?? mod) as StockfishNative;
  if (native && typeof native.sendCommand !== "function") native = null;
} catch {
  native = null;
}

export function stockfishAvailable(): boolean {
  return native != null;
}

/**
 * Map our target ELO → Stockfish UCI strength options. Stockfish's
 * `UCI_LimitStrength`/`UCI_Elo` covers ~1320–2850; below the floor we approximate
 * with `Skill Level` (0–20). This is exactly how chess.com / lichess scale it.
 */
export function eloToUci(elo: number): string[] {
  const e = Math.max(300, Math.min(2850, Math.round(elo)));
  if (e >= 1320) {
    return ["setoption name UCI_LimitStrength value true", `setoption name UCI_Elo value ${e}`];
  }
  const skill = Math.max(0, Math.min(20, Math.round((e - 300) / 51))); // 300→0 … ~1320→20
  return ["setoption name UCI_LimitStrength value false", `setoption name Skill Level value ${skill}`];
}

/** Parse a UCI "bestmove e2e4 ponder e7e5" / "bestmove e7e8q" / "bestmove (none)" line. */
export function parseBestMove(line: string): Move | null {
  const m = /^bestmove\s+(\S+)/.exec(line.trim());
  if (!m || !m[1] || m[1] === "(none)") return null;
  const uci = m[1];
  if (uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci.slice(4, 5) : undefined };
}

let started = false;
async function ensureStarted(): Promise<void> {
  if (!native || started) return;
  native.start();
  native.sendCommand("uci");
  native.sendCommand("setoption name Threads value 1");
  native.sendCommand("setoption name Hash value 16");
  native.sendCommand("isready");
  started = true;
}

/** EngineAdapter: best move for (fen, elo) using native Stockfish, or null if unavailable. */
export async function nativeBestMove(fen: string, elo: number, moveTimeMs = 700): Promise<Move | null> {
  if (!native) return null;
  await ensureStarted();
  return new Promise<Move | null>((resolve) => {
    let done = false;
    const finish = (m: Move | null) => {
      if (done) return;
      done = true;
      sub.remove();
      resolve(m);
    };
    const sub = native!.addListener("stockfish-output", ({ line }) => {
      if (line.startsWith("bestmove")) finish(parseBestMove(line));
    });
    for (const opt of eloToUci(elo)) native!.sendCommand(opt);
    native!.sendCommand("ucinewgame");
    native!.sendCommand(`position fen ${fen}`);
    native!.sendCommand(`go movetime ${Math.max(100, Math.round(moveTimeMs))}`);
    // Safety timeout so a stuck engine never hangs the UI (falls back to JS).
    setTimeout(() => finish(null), moveTimeMs + 1500);
  });
}
