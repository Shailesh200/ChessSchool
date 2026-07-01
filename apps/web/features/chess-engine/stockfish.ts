"use client";

import type { MoveInput } from "@/core/types/chess";
import type { PieceSymbol } from "chess.js";

/**
 * Stockfish 18 (lite, single-threaded WASM) self-hosted in /public/engine.
 * Loaded as a plain Web Worker — no bundler involvement, no COOP/COEP headers.
 * Falls back gracefully: callers use the JS engine if this returns null.
 */
let worker: Worker | null = null;
let ready: Promise<boolean> | null = null;

function ensure(): Promise<boolean> {
  if (ready) return ready;
  ready = new Promise<boolean>((resolve) => {
    if (typeof Worker === "undefined") return resolve(false);
    let w: Worker;
    try {
      w = new Worker("/engine/stockfish-18-lite-single.js");
    } catch {
      return resolve(false);
    }
    const onMsg = (e: MessageEvent) => {
      if (String(e.data).includes("uciok")) {
        w.removeEventListener("message", onMsg);
        worker = w;
        resolve(true);
      }
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", () => resolve(false));
    w.postMessage("uci");
    setTimeout(() => {
      if (!worker) resolve(false);
    }, 8000);
  });
  return ready;
}

/** Map a target ELO to Stockfish strength settings. */
function strengthCmds(elo: number): string[] {
  if (elo >= 1320) {
    // Stockfish calibrates human-like strength directly from ~1320 upward.
    return ["setoption name UCI_LimitStrength value true", `setoption name UCI_Elo value ${Math.min(2850, elo)}`];
  }
  // Below that floor, use Skill Level (0–20); 800→~1, 1300→~6.
  const skill = Math.max(0, Math.min(8, Math.round((elo - 700) / 100)));
  return ["setoption name UCI_LimitStrength value false", `setoption name Skill Level value ${skill}`];
}

const movetimeFor = (elo: number) => Math.round(Math.min(800, 140 + elo * 0.3));

/** Ask Stockfish for a move; resolves null if the engine is unavailable. */
export async function stockfishMove(fen: string, elo: number): Promise<MoveInput | null> {
  if (!(await ensure()) || !worker) return null;
  const w = worker;
  const movetime = movetimeFor(elo);
  return new Promise<MoveInput | null>((resolve) => {
    const onMsg = (e: MessageEvent) => {
      const line = String(e.data);
      if (line.startsWith("bestmove")) {
        w.removeEventListener("message", onMsg);
        const mv = line.split(" ")[1];
        if (!mv || mv === "(none)") return resolve(null);
        resolve({
          from: mv.slice(0, 2),
          to: mv.slice(2, 4),
          promotion: mv.length > 4 ? (mv[4] as PieceSymbol) : undefined,
        });
      }
    };
    w.addEventListener("message", onMsg);
    for (const cmd of strengthCmds(elo)) w.postMessage(cmd);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${movetime}`);
    // Safety: if the engine never answers, release the caller.
    setTimeout(() => {
      w.removeEventListener("message", onMsg);
      resolve(null);
    }, movetime + 5000);
  });
}
