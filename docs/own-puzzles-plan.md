# Own puzzles — phase 1 plan

Phase 1 only. The bundled pack in `packages/chessschool-chess/src/puzzles.data.ts` is unchanged. Gym, daily puzzle, and sprint code are unchanged. They keep reading `PUZZLE_THEME_TAGS` and `PUZZLE_ROWS`.

Sample: [`docs/own-puzzles-sample.json`](own-puzzles-sample.json) (20 puzzles).  
Generator: `packages/chessschool-chess/scripts/generate-own-puzzles.mjs`.

```bash
node packages/chessschool-chess/scripts/generate-own-puzzles.mjs \
  --count 20 --seed 20261113 --games 48 --pool 140 \
  --out docs/own-puzzles-sample.json
```

That command took about 45 seconds here (48 games, 59 screen hits, 49 verified, 37 after dropping later fragments of the same combination). Same seed, same Stockfish build, one thread, fixed depth, hash cleared before every search. No movetime, so a faster machine does not change the moves.

## Method

Positions come from games the script plays with the Stockfish 18 lite WASM already in the repo:

`apps/web/public/engine/stockfish-18-lite-single.js` (+ `.wasm`, net `nn-9067e33176e8.nnue`, GPLv3).

No puzzle database is read. No new dependency.

Each game starts with one of 20 short move pairs checked by chess.js, then Stockfish plays both sides at depth 8. Even games play accurately until ply 34, then make small mistakes, so some games reach an endgame. Odd games are allowed larger mistakes, including blunders, so mates and free pieces show up. From ply 8, a position is a candidate when a depth-8 MultiPV search says the side to move has a unique win or a unique save. The line is then rebuilt at depth 12. The stored gaps are the depth-12 gaps. If depth 12 disagrees, the position is dropped.

The puzzle FEN is the position before the move that was just played. That move is the opponent's setup move (the app plays it automatically). The learner's moves are the ones that had to be unique. A row is the same tuple the app already parses:

`[id, fen, uci moves, rating, theme indexes]`

Ids are `csp-0001` onward. Theme index order is the existing `PUZZLE_THEME_TAGS` list.

## Eval thresholds

All scores are from the side to move. A mate is ranked beyond any centipawn score. `gap` is best minus second, with a mate converted so that a unique short mate still clears the bar.

| Check | Rule |
|---|---|
| Minimum gap | 150 centipawns, on every learner move |
| Unique win | Best is at least +150, and the second move is at most +50. A mate counts only when the other move is not also a win (slower mate, or at most +50). |
| Unique save | Best holds (at least −50) and the second move loses (mate, or at most −250). |
| Opponent reply | Kept only when it is the only legal move, or it beats the next defense by 80 centipawns, or it is the only move that avoids a faster mate. Otherwise the line stops on the learner's previous move. |
| Length | 1–3 learner moves, so the UCI list has length 2, 4, or 6, matching the current pack. |
| Screen / verify | Depth 8 MultiPV 3 to find candidates. Depth 12 MultiPV 2, hash cleared, to accept them. |

## Theme tags

Tags are geometry on the line, not a copy of anyone else's labels. A puzzle can have several. Order is the app's list.

| Tag | Rule |
|---|---|
| mateIn1 / mateIn2 | The line ends in mate on the learner's 1st or 2nd move. |
| backRankMate | That mate is by a rook or queen and the king is on rank 1 or 8. |
| fork | The moved piece attacks two enemy units (king or worth at least a knight), and it is a knight or pawn, or at least one target is loose or the king. |
| pin / skewer | The move creates a new pin (lesser piece in front of the king or a heavier piece) or skewer (heavier piece in front). |
| discoveredAttack | A slider that did not move gains a new target. |
| hangingPiece | The move captures a piece that had no defender. |
| sacrifice | The learner puts a heavier piece where a lesser piece attacks it, or comes out of the sequence down at least a knight, and the line is still the engine's choice. |
| promotion | Any move in the line promotes. |
| endgame | 14 pieces or fewer, or no queens and 20 pieces or fewer. |
| defensiveMove | The learner is in check, or the move is a unique save rather than a unique win. |

Promotion is implemented and covered by a unit test. This seed did not produce one. Mate in 1 is implemented too. This seed found one, and it was the last move of the mate in 2 below, so the sample keeps the longer line.

## Rating

There is no player history, so the rating is a fixed function of the line, clamped to 400–1999:

- Start at 1520 and subtract `1.1 × gap` (gap capped at 950).
- Add 280 for each learner move after the first.
- Mate in one: −220. Mate in two: −40. A check: −70. A quiet key move: +220.
- Crowded board (24+ pieces): +40. Bare board (12 or fewer): −70.
- A non-mating save: +20. A quiet sacrifice: +70.

A free piece with a huge gap lands near the bottom. A quiet two-move idea lands near the top. The current pack is flat on purpose (the old builder took 95 puzzles from each 100-point bucket). This function will not do that by itself. The full run should keep generating until those buckets are filled, and should use a slightly smaller gap (proposed 120, still at depth 12 or 14) only for the 1600–1999 buckets. This seed's pool tops out at 1450.

## What the follow-up deletes, and what it does not

v2's Lichess puzzle data, after this plan is approved:

- Replace the rows in `packages/chessschool-chess/src/puzzles.data.ts`. Keep the export names and the tuple shape. New ids, no external game links.
- Retire `packages/chessschool-chess/scripts/build-puzzles.mjs` as the pack builder. The new script writes the pack instead.
- `data/chess-school-puzzles.csv.gz` is the export v2's builder reads (it has `GameUrl` values on lichess.org). See the question below before deleting the file.

Not in this task, and not in the follow-up unless you say so:

- `packages/puzzle-school/data/puzzles/**` — the old app's bank. Do not remove or edit it.
- Piece sets. They still carry their own attribution. Out of scope.
- `puzzles.ts`, gym, daily puzzle, sprint, and the puzzle player.

## Old bank (report only)

`packages/puzzle-school/data/puzzles/**/*.jsonl` has **50,344** puzzles. Every row has `sourceRef` starting with `lichess:`. Stages are about 7,200 each (elementary through master). The old web app loads this bank through `@chess-school/puzzle-school` and the curriculum import. v2 does not. Removing it would break the old app. It stays until a later cutover.

The CSV is also the default input of the old import commands (`import-lichess.mjs`, `import-homework.mjs`, `puzzle-school adapt-csv`). Those are not part of the old app's compile. The committed jsonl is what the old app ships.

## Distribution

Current v2 pack: **1,520** puzzles, **exactly 95** in each 100-point bucket from 400–499 through 1900–1999. Move lists: 316 of length 2, 786 of length 4, 418 of length 6. Theme counts (a puzzle can have several; 166 have none):

| Theme | Current pack | Share | This sample (20) | Pool before the pick (49) |
|---|---:|---:|---:|---:|
| mateIn1 | 316 | 21% | 0 | 1 |
| mateIn2 | 221 | 15% | 1 | 1 |
| fork | 206 | 14% | 3 | 4 |
| pin | 13 | 1% | 4 | 8 |
| skewer | 1 | 0% | 5 | 5 |
| hangingPiece | 219 | 14% | 8 | 28 |
| discoveredAttack | 22 | 1% | 5 | 6 |
| backRankMate | 69 | 5% | 1 | 2 |
| promotion | 43 | 3% | 0 | 0 |
| endgame | 713 | 47% | 1 | 7 |
| defensiveMove | 202 | 13% | 9 | 25 |
| sacrifice | 60 | 4% | 4 | 4 |
| no tag | 166 | 11% | 2 | 4 |

The old pack's pin and skewer counts are tiny because the old builder preferred popular short puzzles and then capped each theme. Our tags mark the geometry whenever it is there, so pins and skewers are a larger share. Endgames are a smaller share because the tag requires a reduced board, and half the games are still in the middlegame when a tactic appears. The full run should keep the even-game path long enough to fill the endgame quota (about 700 of 1,500).

Sample ratings (not flat — this is the raw function, then a pick that spreads 200-point bands and primary themes):

| Bucket | Sample |
|---|---:|
| 500–599 | 1 |
| 600–699 | 1 |
| 700–799 | 1 |
| 900–999 | 2 |
| 1000–1099 | 3 |
| 1100–1199 | 3 |
| 1200–1299 | 5 |
| 1300–1399 | 2 |
| 1400–1499 | 2 |

The pool also had 2 puzzles in 400–499 and 2 in 800–899. Nothing in this seed reached 1500+.

## The 20 puzzles

`gap` is the learner's first move at depth 12. The second column of the eval is the other move. Full per-ply scores are in the JSON.

| Id | Rating | Gap | Themes | Moves | First-move eval | FEN |
|---|---:|---:|---|---|---|---|
| csp-0001 | 1245 | 268 | hangingPiece, defensiveMove | `c3d1 b7c6` | +10 vs −258 | `r1b2rk1/ppp1b1pp/2N5/5p2/5R2/2N5/PPP2PPP/R1Bq2K1 w - - 0 13` |
| csp-0002 | 1427 | 303 | pin, defensiveMove | `e4c5 a6b6` | +50 vs −253 | `r7/pp3pkp/q5p1/5b2/4NP2/3r4/PPQ3PP/2R1R1K1 w - - 0 26` |
| csp-0003 | 1124 | 378 | defensiveMove | `c6e7 d5e7` | −24 vs −402 | `5rk1/4n1p1/2N2q2/1pQn1p1p/4p3/6P1/4PPBP/4R1K1 w - - 2 28` |
| csp-0004 | 761 | 726 | hangingPiece | `d8d4 f3d4` | +246 vs −480 | `r2qk2r/pp2bppp/4p3/2P5/3Qn3/5N2/P1P2PPP/RNB2RK1 b kq - 0 11` |
| csp-0005 | 976 | 513 | pin, hangingPiece, defensiveMove | `f4d6 d8d6` | +10 vs −503 | `r1qr2k1/p4ppp/1p1b4/3P4/5B2/8/P3QPPP/R2R2K1 w - - 1 22` |
| csp-0006 | 566 | 867 | pin, hangingPiece | `g7g8 c3f6` | +394 vs −473 | `6R1/5pk1/1p1rpq1p/p4np1/4R3/2Q4P/PP3PP1/6K1 b - - 7 30` |
| csp-0007 | 1107 | 530 | mateIn2, fork, skewer, backRankMate, sacrifice | `f7d5 c1c8 d8c8 d6c7` | mate 2 vs −50 | `N2k2nr/p2b1qbp/3Q4/1p1P4/7P/4n3/PP2P1P1/2R1KB1R b K - 0 24` |
| csp-0008 | 1379 | 437 | defensiveMove, sacrifice | `b6b1 a1b1 b8b1 e1d2` | +22 vs −415 | `1r2k2r/3n1ppp/1q1ppn2/P2p1b2/3P4/Q1P2N2/P3PPPP/RN2KB1R b KQk - 0 11` |
| csp-0009 | 992 | 498 | hangingPiece, defensiveMove | `e8e2 d3e2` | +514 vs +16 | `r3r1k1/pp3ppp/2p2p2/b7/3P4/2PB4/PPK1NPPP/3R3R b - - 2 16` |
| csp-0010 | 1412 | 298 | — | `f4c7 e7d8` | +283 vs −15 | `r1b1r1k1/p1p1b2p/2p5/5pp1/2R2B2/8/PPP2PPP/R2N2K1 w - - 0 16` |
| csp-0011 | 677 | 766 | hangingPiece, endgame | `f3f8 c8f8` | +386 vs −380 | `2r2r2/p5pp/1p2k3/2ppP3/3P3b/B4R2/P5PP/R5K1 w - - 6 27` |
| csp-0012 | 1165 | 314 | fork, defensiveMove | `d2b1 b6c4` | −2 vs −316 | `5rk1/5ppp/Pn1pp3/3p1b2/3Pn3/Q1P1K2P/P2NPPP1/1r3B1R w - - 3 18` |
| csp-0013 | 1201 | 326 | skewer, discoveredAttack | `d6c5 d4c5` | +341 vs +15 | `r3r1k1/1bp1qpp1/pp1bpn1p/n1P5/3P4/4PN2/PB2NPPP/1BRQ1RK1 b - - 0 17` |
| csp-0014 | 1283 | 406 | discoveredAttack, sacrifice | `g2g4 d3g3 h2g3 f5c2` | +269 vs −137 | `r7/pp3pkp/1q4p1/2N2b2/5P2/3r4/PPQ3PP/2R1R1K1 w - - 2 27` |
| csp-0015 | 1028 | 484 | skewer, discoveredAttack | `f8b4 a3b4` | +105 vs −379 | `2kr1b1r/ppp2ppp/2n2n2/q3p2b/1P1P4/P1N1BN1P/2P1BPP1/R2QK2R b KQ - 0 10` |
| csp-0016 | 1261 | 235 | discoveredAttack | `c5d6 e4a8` | +193 vs −42 | `r4rk1/p4pp1/1p2p2p/2q5/3nB3/3Q4/PP3PPP/2R1R1K1 b - - 5 19` |
| csp-0017 | 1081 | 590 | fork, hangingPiece, discoveredAttack, sacrifice | `e1c1 d7d1 c1d1 c8e6` | +302 vs −288 | `1kq2r2/1p1rb2p/p3Qp2/4p3/4N2N/1PP3P1/4RP1P/2n1R1K1 w - - 1 26` |
| csp-0018 | 1019 | 510 | skewer, defensiveMove | `g4h3 g3h3` | +18 vs −492 | `4r1k1/1p3ppp/n1p5/p1b1r3/P3P1bq/2N3QB/1PP1N1K1/R1B2R2 b - - 3 19` |
| csp-0019 | 1202 | 307 | pin, skewer, hangingPiece, defensiveMove | `c8c5 c1c5` | −9 vs −316 | `2r2rk1/4n1p1/8/1pRn1p1p/3Np3/6P1/qP2PPBP/2Q1R1K1 b - - 5 25` |
| csp-0020 | 1325 | 214 | — | `c8e6 c3d5` | +174 vs −40 | `rnbqk2r/ppp2ppp/8/3np3/1b6/1QN1P3/PP1PNPPP/R1B1KB1R b KQkq - 1 6` |

## Questions for review

1. **CSV.** Delete `data/chess-school-puzzles.csv.gz` in the follow-up, or leave the file until the old app is retired and only stop v2 from reading it? Deleting it does not change the old app's compile or the jsonl bank. It does make `db:import-homework` and `puzzle-school adapt-csv` fail if someone runs them again.
2. **Top ratings.** Is a 120 centipawn gap, still checked at depth 12 or 14, acceptable for the 1600–1999 buckets? At 150 centipawns this seed never got there.
3. **Endgame quota.** The full run should spend more games on the long accurate path so the endgame tag can approach the current pack's share. Worth confirming before that run.
