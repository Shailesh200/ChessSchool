# ChessSchool — single-container image (FE + BE + SQLite).
# Deploys to any container host (Railway, Render, Fly.io, a VPS).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Install deps (build scripts for better-sqlite3 are allow-listed in package.json)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the app
COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
# DB lives on a mounted volume so users/progress persist across deploys.
ENV DATABASE_URL=/app/data/local.db
EXPOSE 3000

# On boot: create + seed the DB if the volume is empty, then start FE+BE.
CMD ["sh", "-c", "mkdir -p /app/data && pnpm setup && pnpm start:app"]
