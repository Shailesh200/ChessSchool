# Own puzzle pack

Version `own-2026.11.13-s20261113`.

## Settings

- Screen depth 8. Verify depth 12 with a 150 centipawn gap for ratings under 1600.
- Ratings 1600–1999 are confirmed at depth 14. The top shards use a 100 centipawn gap; earlier high shards used 120. The pack accepts either, as long as the gap is at least 100.
- One Stockfish thread, hash cleared before every search. No movetime.
- Defence is capped at 20% of the pack. Every puzzle has at least one theme.

## Shards

| Mode | Seed | Kept | Runtime |
|---|---:|---:|---:|
| tactical | 20261113 | 197 | 870s |
| mixed | 20261123 | 159 | 824s |
| endgame | 20261117 | 81 | 732s |
| quiet | 20261119 | 211 | 1004s |
| promo | 20261211 | 20 | 472s |
| high | 20261129 | 88 | 809s |
| high | 20261207 | 62 | 817s |
| high | 20261219 | 78 | 815s |
| top | 20261223 | 10 | 1039s |
| top | 20261229 | 8 | 907s |
| top | 20270103 | 5 | 907s |
| top | 20270107 | 12 | 914s |
| top | 20270111 | 8 | 891s |

## Pack

570 puzzles. 100 in the offline fallback.

| Bucket | Count |
|---|---:|
| 400–499 | 29 |
| 500–599 | 14 |
| 600–699 | 23 |
| 700–799 | 29 |
| 800–899 | 49 |
| 900–999 | 119 |
| 1000–1099 | 62 |
| 1100–1199 | 54 |
| 1200–1299 | 79 |
| 1300–1399 | 27 |
| 1400–1499 | 52 |
| 1500–1599 | 14 |
| 1600–1699 | 9 |
| 1700–1799 | 4 |
| 1800–1899 | 3 |
| 1900–1999 | 3 |

| Theme | Count |
|---|---:|
| mateIn1 | 108 |
| mateIn2 | 23 |
| fork | 62 |
| pin | 39 |
| skewer | 70 |
| hangingPiece | 294 |
| discoveredAttack | 56 |
| backRankMate | 48 |
| promotion | 3 |
| endgame | 184 |
| defensiveMove | 43 |
| sacrifice | 53 |

Untagged: 0. Defence: 43 (7.5%).

Floor of 40 per bucket, still short: 400:29, 500:14, 600:23, 700:29, 1300:27, 1500:14, 1600:9, 1700:4, 1800:3, 1900:3.

Floor of 20 per theme, still short: promotion:3.

1600–1999 reduced floor of 20: 1600:9, 1700:4, 1800:3, 1900:3. Any of those under 20 is a gap.


## Fallback coverage

| Bucket | Count |
|---|---:|
| 400 | 7 |
| 500 | 7 |
| 600 | 7 |
| 700 | 7 |
| 800 | 7 |
| 900 | 7 |
| 1000 | 7 |
| 1100 | 7 |
| 1200 | 7 |
| 1300 | 7 |
| 1400 | 7 |
| 1500 | 6 |
| 1600 | 7 |
| 1700 | 4 |
| 1800 | 3 |
| 1900 | 3 |

| Theme | Count |
|---|---:|
| mateIn1 | 22 |
| mateIn2 | 15 |
| fork | 20 |
| pin | 20 |
| skewer | 20 |
| hangingPiece | 42 |
| discoveredAttack | 19 |
| backRankMate | 9 |
| promotion | 1 |
| endgame | 18 |
| defensiveMove | 5 |
| sacrifice | 20 |
