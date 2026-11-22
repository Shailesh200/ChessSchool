import { describe, expect, it } from "vitest";
import { challengeRecord, filterGames, gameKind, gamePgn, mergeGameLogs, movetext, pgnFileName, resultForYou, sanitizeGameRecord, botsInLog, visibleGames } from "./games";
import { START_FEN, type GameRecord } from "./progress";

const base = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: "g1",
  endedAt: Date.UTC(2026, 10, 20, 9),
  setup: { opponent: { kind: "bot", bot: "pip" }, you: "w", time: "none", startFen: START_FEN, takebacks: true, askPromotion: true },
  history: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
  winner: "w",
  reason: "checkmate",
  ...over,
});

describe("my games", () => {
  it("tells the kinds and results apart", () => {
    expect(gameKind(base())).toBe("bot");
    expect(resultForYou(base())).toBe("win");
    expect(resultForYou(base({ winner: "b" }))).toBe("loss");
    expect(resultForYou(base({ winner: null, reason: "stalemate" }))).toBe("draw");
    const friend = base({ setup: { ...base().setup, opponent: { kind: "friend" } } });
    expect(gameKind(friend)).toBe("friend");
    expect(resultForYou(friend)).toBeNull();
    expect(gameKind(base({ reason: "imported", setup: { ...base().setup, opponent: { kind: "online" } } }))).toBe("imported");
    expect(gameKind(base({ reason: "scanned" }))).toBe("scanned");
  });

  it("filters by result, kind and bot", () => {
    const log = [base(), base({ id: "g2", winner: "b" }), base({ id: "g3", setup: { ...base().setup, opponent: { kind: "bot", bot: "rooky" } } }), challengeRecord({ code: "ABC", you: "b", moves: ["e4", "e5"], result: "0-1" }, 5)!];
    expect(filterGames(log, { kind: "all", result: "win" }).map((g) => g.id)).toEqual(["g1", "g3", "challenge:ABC"]);
    expect(filterGames(log, { kind: "challenge", result: "all" }).map((g) => g.id)).toEqual(["challenge:ABC"]);
    expect(filterGames(log, { kind: "bot", result: "all", bot: "rooky" }).map((g) => g.id)).toEqual(["g3"]);
    expect(botsInLog(log)).toEqual(["pip", "rooky"]);
  });

  it("never lists imported games (the feature is gone; old records stay stored)", () => {
    const imported = base({ id: "lichess:x", reason: "imported", setup: { ...base().setup, opponent: { kind: "online" } } });
    const log = [base(), imported];
    expect(visibleGames(log).map((g) => g.id)).toEqual(["g1"]);
    expect(filterGames(log, { kind: "all", result: "all" }).map((g) => g.id)).toEqual(["g1"]);
    expect(sanitizeGameRecord(imported)?.id).toBe("lichess:x");
  });

  it("keeps the players' move-list colours", () => {
    const g = base({ setup: { ...base().setup, whiteHue: "orange" } });
    expect(sanitizeGameRecord(g)?.setup.whiteHue).toBe("orange");
    expect(sanitizeGameRecord({ ...g, setup: { ...g.setup, whiteHue: "red" } })?.setup.whiteHue).toBeUndefined();
  });

  it("writes PGN with headers, numbering and the result", () => {
    const pgn = gamePgn(base(), { white: "You", black: "Pip" });
    expect(pgn).toContain('[White "You"]');
    expect(pgn).toContain('[Black "Pip"]');
    expect(pgn).toContain('[Date "2026.11.20"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).not.toContain("SetUp");
    expect(pgn.trim().endsWith("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0")).toBe(true);
    const fen = "4k3/8/8/8/8/8/4P3/4K3 b - - 0 30";
    const black = gamePgn(base({ setup: { ...base().setup, startFen: fen }, history: ["Kd7", "e4"], winner: null, reason: "draw" }), { white: "A \"quoted\"", black: "B" });
    expect(black).toContain(`[FEN "${fen}"]`);
    expect(black).toContain('[White "A quoted"]');
    expect(black.trim().endsWith("30... Kd7 31. e4 1/2-1/2")).toBe(true);
    expect(movetext(START_FEN, [])).toBe("");
    expect(pgnFileName(base(), "Pip")).toBe("chessschool-2026-11-20-pip.pgn");
  });

  it("wraps long games at 80 columns", () => {
    const long = gamePgn(base({ history: Array.from({ length: 60 }, (_, i) => (i % 2 ? "Nf6" : "Nf3")) }), { white: "a", black: "b" });
    expect(long.split("\n").every((l) => l.length <= 80)).toBe(true);
  });

  it("merges the account's games with the device's, refusing junk", () => {
    const local = [base({ id: "a", endedAt: 10, reviewed: true })];
    const remote = [{ ...base({ id: "a", endedAt: 10 }) }, base({ id: "b", endedAt: 20 }), { id: "bad" }, { ...base({ id: "c" }), history: ["<script>"] }];
    const merged = mergeGameLogs(local, remote);
    expect(merged.map((g) => g.id)).toEqual(["b", "a"]);
    expect(merged[1].reviewed).toBe(true);
    expect(sanitizeGameRecord({ ...base(), setup: { ...base().setup, startFen: "nope" } })).toBeNull();
    expect(sanitizeGameRecord(base())).toEqual(base());
  });

  it("records a finished challenge without the friend's name", () => {
    expect(challengeRecord({ code: "X", you: null, moves: ["e4"], result: "1-0" }, 1)).toBeNull();
    const r = challengeRecord({ code: "X", you: "w", moves: ["e4", "e5"], result: "1/2-1/2" }, 1)!;
    expect(r).toMatchObject({ id: "challenge:X", reason: "challenge", winner: null });
    expect(resultForYou(r)).toBe("draw");
  });
});
