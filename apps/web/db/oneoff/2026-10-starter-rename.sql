-- One-off fallback for the Pre-School -> Starter content rename.
-- Source sha: f7a74c2 (f7a74c2f50038b7044c45a977d8e0b9ffe3f56e5), PR #31.
-- Muse may still tweak wording; regenerate this file from that sha (or a newer #31 head).
--
-- Not a Drizzle migration. Do not add it to db/migrations or meta/_journal.json.
-- Primary path for this copy is B7 dry-run upsert (apps/web/scripts/seed-remote.mjs).
-- This file is only the fallback.
--
-- Run on the staging database first.
-- Production only with Shailesh's OK, after a backup, run by Dex.
-- Do not run a full reseed on production.
-- Run this whole file as one script so BEGIN/COMMIT stay a single transaction.
--
-- Stage display name is not a database row (nothing to UPDATE):
-- stage-name source: apps/web/content/data/school.mjs:5
-- stage-name id: preschool
-- stage-name property: name
-- stage-name table: none
-- stage-name column: none
-- stage-name old: Pre-School
-- stage-name new: Starter
-- nearest-db: semesters.id = 'sem-preschool' column stage = 'preschool' (slug, not the display name). semesters.title stays 'Chess Basics'.
--
-- Database targets are the full lessons.steps JSON, exact match:
-- lessons.id = 'pre-game-goal' column steps
-- lessons.id = 'pre-notation-practice' column steps

BEGIN;

SELECT id, steps
FROM lessons
WHERE id IN ('pre-game-goal', 'pre-notation-practice')
ORDER BY id;

UPDATE lessons SET steps = '[{"id":"goal-info","kind":"info","coach":"The goal of chess is to checkmate your opponent''s king. You can also win if they resign (give up) when the position is hopeless. In the Starter stage we learn the rules — real timed games come later in Play mode!","fen":"7k/6Q1/6K1/8/8/8/8/8 b - - 0 1","highlight":["h8","g7"],"orientation":"white"}]'
WHERE id = 'pre-game-goal'
  AND steps = '[{"id":"goal-info","kind":"info","coach":"The goal of chess is to checkmate your opponent''s king. You can also win if they resign (give up) when the position is hopeless. In Pre-School we learn the rules — real timed games come later in Play mode!","fen":"7k/6Q1/6K1/8/8/8/8/8 b - - 0 1","highlight":["h8","g7"],"orientation":"white"}]';

UPDATE lessons SET steps = '[{"id":"play-d6","kind":"move","coach":"Play pawn to d6 — push the pawn from d5 forward to d6.","fen":"k7/8/8/3P4/8/8/8/7K w - - 0 1","solution":["d5:d6"],"highlight":["d5"],"highlightFiles":["d"],"highlightRanks":[5,6],"successText":"d6! You read the square and played the right move.","failText":"Move the pawn on d5 one square forward to d6.","tag":"preschool"},{"id":"play-nf3","kind":"move","coach":"Play Nf3 — develop the knight from g1 to f3.","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","solution":["g1:f3"],"highlight":["g1"],"highlightFiles":["g","f"],"highlightRanks":[1,3],"successText":"Nf3 — well done! You are reading chess notation.","failText":"Hop the knight from g1 to f3.","tag":"preschool"},{"id":"finish","kind":"info","coach":"You now know the board, the pieces, and how to read moves like d6, e4, Nf3, and Qd5. Starter complete — head to Elementary when you are ready, or replay any lesson for practice!","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","highlight":["e4","d5"]}]'
WHERE id = 'pre-notation-practice'
  AND steps = '[{"id":"play-d6","kind":"move","coach":"Play pawn to d6 — push the pawn from d5 forward to d6.","fen":"k7/8/8/3P4/8/8/8/7K w - - 0 1","solution":["d5:d6"],"highlight":["d5"],"highlightFiles":["d"],"highlightRanks":[5,6],"successText":"d6! You read the square and played the right move.","failText":"Move the pawn on d5 one square forward to d6.","tag":"preschool"},{"id":"play-nf3","kind":"move","coach":"Play Nf3 — develop the knight from g1 to f3.","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","solution":["g1:f3"],"highlight":["g1"],"highlightFiles":["g","f"],"highlightRanks":[1,3],"successText":"Nf3 — well done! You are reading chess notation.","failText":"Hop the knight from g1 to f3.","tag":"preschool"},{"id":"finish","kind":"info","coach":"You now know the board, the pieces, and how to read moves like d6, e4, Nf3, and Qd5. Pre-School complete — head to Elementary when you are ready, or replay any lesson for practice!","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","highlight":["e4","d5"]}]';

COMMIT;
