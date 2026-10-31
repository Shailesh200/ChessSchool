#!/usr/bin/env python3
"""Spot-check puzzle solutions with Stockfish (not a repo dependency)."""
from __future__ import annotations

import json
import sqlite3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "apps/web/local.db"
STOCKFISH = "/usr/games/stockfish"
SAMPLE_LIMIT = 400  # enough coverage without blocking CI


def uci_best(fen: str, depth: int = 12) -> str | None:
    proc = subprocess.Popen(
        [STOCKFISH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    assert proc.stdin and proc.stdout
    cmds = [
        "uci",
        "isready",
        f"position fen {fen}",
        f"go depth {depth}",
        "quit",
    ]
    proc.stdin.write("\n".join(cmds) + "\n")
    proc.stdin.flush()
    best = None
    for line in proc.stdout:
        if line.startswith("bestmove "):
            best = line.split()[1]
            break
    proc.wait(timeout=30)
    return best if best and best != "(none)" else None


def parse_solution(sol: list[str]) -> tuple[str, str] | None:
    if not sol or len(sol) != 1:
        return None
    ply = sol[0]
    if ":" not in ply:
        return None
    f, t = ply.split(":", 1)
    return f, t


def uci_from_ply(fr: str, to: str, promo: str = "q") -> str:
    u = f"{fr}{to}"
    if promo and promo != "q":
        u += promo
    return u


def main() -> None:
    if not DB.exists():
        print("skip: no local.db")
        return
    con = sqlite3.connect(DB)
    cur = con.execute(
        "SELECT id, steps FROM lessons WHERE id NOT LIKE 'pre-%' ORDER BY RANDOM() LIMIT ?",
        (SAMPLE_LIMIT,),
    )
    mismatches = []
    checked = 0
    for lesson_id, steps_json in cur:
        try:
            steps = json.loads(steps_json)
        except json.JSONDecodeError:
            continue
        for step in steps:
            if step.get("kind") != "move":
                continue
            fen = step.get("fen")
            sol = step.get("solution") or []
            parsed = parse_solution(sol)
            if not fen or not parsed:
                continue
            checked += 1
            fr, to = parsed
            expected = uci_from_ply(fr, to)
            best = uci_best(fen)
            if best and best != expected:
                # accept promotions written without suffix when best matches prefix
                if not best.startswith(expected[:4]):
                    mismatches.append(
                        {
                            "lesson": lesson_id,
                            "step": step.get("id"),
                            "fen": fen,
                            "marked": expected,
                            "stockfish": best,
                        }
                    )
    print(json.dumps({"checked": checked, "mismatches": mismatches[:20], "mismatch_count": len(mismatches)}, indent=2))


if __name__ == "__main__":
    main()
