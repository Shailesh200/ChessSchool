#!/usr/bin/env node
// Puzzle packs are served by GET /v1/puzzles/pack.
// The app ships only the stub pack in src/puzzles.fallback.ts until that endpoint is seeded.
console.log("puzzle packs are loaded from the API; src/puzzles.fallback.ts is the offline stub");
