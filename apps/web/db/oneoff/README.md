# Starter rename fallback SQL

`2026-10-starter-rename.sql` is a one-off content patch. Source sha: `f7a74c2`
(`f7a74c2f50038b7044c45a977d8e0b9ffe3f56e5`, PR #31). It is not a Drizzle
migration. Do not register it in `db/migrations` or `meta/_journal.json`.

B7's dry-run upsert (`apps/web/scripts/seed-remote.mjs`) is the primary way this
copy should reach production. This file is only the fallback. `pnpm db:fresh`
does not run it. Nobody runs the full reseed on production.

## What it updates

Two `lessons.steps` values, and only when the stored JSON still equals the
staging `seed.sql` text exactly (full column match, no `LIKE`):

- `lessons.id = 'pre-game-goal'`
- `lessons.id = 'pre-notation-practice'`

The new coach sentences match `lessons.mjs` at `f7a74c2` word for word, so a
later B7 dry run should show no diff on these rows. Muse may still tweak the
wording; regenerate this file from that sha, or from a newer #31 head.

## Stage display name

There is no stage-name row in the database.

|              |                                      |
| ------------ | ------------------------------------ |
| Source       | `apps/web/content/data/school.mjs:5` |
| Id           | `preschool` (`STAGES` entry)         |
| Property     | `name`                               |
| Old          | `Pre-School`                         |
| New (PR #31) | `Starter`                            |
| Table        | none                                 |
| Column       | none                                 |

Campus, catalog, and `/api/campus` read that `name` from application code. The
seeder imports semesters, not `STAGES`. The nearest database key stays as it is:
`semesters.id = 'sem-preschool'`, column `stage` = `preschool` (the slug).
`title` on that row stays `Chess Basics`.

## How to run

1. Staging database first. Run the whole file as one script so `BEGIN` /
   `COMMIT` stay a single transaction. Do not stop after the opening `SELECT`.
2. Production only with Shailesh's OK, after a backup, run by Dex.

Do not point this at a remote database from a laptop seed script, and do not
reseed production to pick up the copy.
