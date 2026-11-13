# Deploying chessschool-web

Vercel project for this PWA. No domain is configured in the repo.

## Project settings

- Root Directory: `apps/chessschool-web`
- Node.js: `22.x` (`engines.node` in this package, and in the other v2 packages)
- `vercel.json` installs with `pnpm install --frozen-lockfile` from the monorepo root, then runs `pnpm run build` in this directory. That runs the `prebuild` hook `scripts/sync-assets.mjs` before `next build`, which copies design and piece assets into `public/assets` (gitignored).

Set the Root Directory in the Vercel project to `apps/chessschool-web`. `vercel.json` in this folder applies only with that root. Do not add a domain until one is chosen.

## Git deploys

`git.deploymentEnabled` turns automatic Git deploys off for `feat/v2-*` and `stable`. Those branches never auto-deploy.

A deploy from `main` happens only when Shailesh merges and gives his OK.

## Environment

| Name | Required | Value |
| --- | --- | --- |
| `CHESSSCHOOL_API_URL` | yes | `https://api.chess-school.in` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | yes | Web client ID (same client the web button uses) |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin of this app, once the domain is chosen |
| `BASE_URL` | no | E2E only. Defaults to `http://localhost:3100` |

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_APP_URL` are inlined at build time. Set them on the project before the build that should ship them. `CHESSSCHOOL_API_URL` is read by `next.config.ts` for the `/v1/*` rewrite.

## Google sign-in

In the GCP web client, add this app's origin (`NEXT_PUBLIC_APP_URL`) to **Authorized JavaScript origins** when the domain is chosen.
