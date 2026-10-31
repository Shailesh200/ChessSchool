#!/usr/bin/env node
import { shouldBuildVercelDeployment } from "./vercel-ignore-logic.mjs";

const build = shouldBuildVercelDeployment(process.env);
const pid = process.env.VERCEL_PROJECT_ID ?? "";
const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";

if (build) {
  console.log(`vercel-ignore: build (VERCEL_PROJECT_ID=${pid} VERCEL_GIT_COMMIT_REF=${ref})`);
  process.exit(1);
}

console.log(`vercel-ignore: skip (VERCEL_PROJECT_ID=${pid} VERCEL_GIT_COMMIT_REF=${ref})`);
process.exit(0);
