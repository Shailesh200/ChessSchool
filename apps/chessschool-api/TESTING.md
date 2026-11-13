# chessschool-api testing

Local checks use an in-memory database or a sqlite file. They do not use a remote database.

## Local QA server

```bash
pnpm --filter chessschool-api qa:serve
```

- Database: `apps/chessschool-api/qa.local.db` (created on start). Set `DATABASE_URL` to another `file:` URL to use a different file. Any other value is refused.
- Port: `8788`, or `PORT` when that is set.
- Bind: `0.0.0.0` (`HOST` overrides it). From an Android emulator: `http://10.0.2.2:8788`.
- Health: `GET /health` and `GET /v1/health`.

Env var names: `PORT`, `HOST`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`, `CORS_ORIGINS`, `NODE_ENV`.

Google sign-in needs `GOOGLE_CLIENT_IDS`. Apple sign-in needs `APPLE_CLIENT_IDS`. Each value is a comma-separated list. If a list is unset, empty, or only commas and spaces, that provider returns 503 and no token is accepted. Email login and the guest account still work.

`POST /v1/auth/apple` requires `identityToken` and a raw `nonce`. The token's `nonce` claim must be the hex sha256 of that raw value. A missing nonce, an empty nonce, a token with no nonce claim, or a mismatch returns 401 `{ "error": "apple_invalid" }`. Google and Apple sign-in match an existing account only by that provider's own subject. If the email is already registered to someone else, the response is 409 `{ "error": "email_in_use" }` and nothing is changed.

Seed logins (this file only):

| email | password | kind | progress |
| --- | --- | --- | --- |
| guest@example.com | pawnpawn | guest | meet done |
| student@example.com | pawnpawn | member | meet and board done; moves is next |

Reset: stop the server, delete `qa.local.db`, run `qa:serve` again.

## Delete QA accounts

```bash
pnpm --filter chessschool-api qa:delete-accounts -- --list <path>
pnpm --filter chessschool-api qa:delete-accounts -- --list <path> --apply --max 200
```

`DATABASE_URL` must be a `file:` URL. A remote URL is refused unless `--remote-prod` is also set. The script prints `database: local` or `database: remote` and never prints the URL, the token, or the host.

Dry-run is the default. With `--remote-prod` and no `--apply`, the run only reads. `--apply` deletes on a local file. `--max` defaults to 200. If more listed accounts are found than `--max`, nothing is deleted.

A remote delete needs all of `--remote-prod`, `--apply`, `--list <file>`, and the exact matched count. At a terminal the operator types that count. Without a terminal, pass `--confirm-count <n>`. A missing or different count aborts and writes nothing. A real production run happens only at launch with Shailesh's own OK.

An account is deleted only when its address is in the list and the local part matches `qa+<tester>-<sha7>-<n>` (`/^qa\+[a-z0-9]+-[0-9a-f]{7}-[0-9]+$/i`). The list is a markdown table whose first column is `email`. Rows that do not match are reported and skipped. The script also reports addresses on the list that are not in the database, and database rows that match the pattern but are not on the list. Those unlisted rows are never deleted.

Deletion removes the same rows as `DELETE /v1/me`: sessions, progress, profile, class membership, owned classes, and feedback.
