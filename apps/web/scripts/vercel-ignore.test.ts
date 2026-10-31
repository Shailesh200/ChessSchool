import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROD_VERCEL_PROJECT_ID,
  TEST_VERCEL_PROJECT_ID,
  shouldBuildVercelDeployment,
} from "./vercel-ignore-logic.mjs";

const scriptDir = import.meta.dirname;
const cli = path.join(scriptDir, "vercel-ignore.mjs");

function runCli(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [cli], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

describe("shouldBuildVercelDeployment", () => {
  it("builds prod project only on main", () => {
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: PROD_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBe(true);
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: PROD_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "rc/nov2",
      }),
    ).toBe(false);
  });

  it("builds test project only on rc/nov2", () => {
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: TEST_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "rc/nov2",
      }),
    ).toBe(true);
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: TEST_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBe(false);
  });

  it("skips unknown project, empty project id, and empty ref (fail closed)", () => {
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: "prj_unknown",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBe(false);
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: "",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBe(false);
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: PROD_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "",
      }),
    ).toBe(false);
  });

  it("skips other branches on either project", () => {
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: PROD_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "feature/x",
      }),
    ).toBe(false);
    expect(
      shouldBuildVercelDeployment({
        VERCEL_PROJECT_ID: TEST_VERCEL_PROJECT_ID,
        VERCEL_GIT_COMMIT_REF: "nov2/other",
      }),
    ).toBe(false);
  });
});

describe("vercel-ignore.mjs CLI", () => {
  it("exits 1 to build and 0 to skip", () => {
    const build = runCli({
      VERCEL_PROJECT_ID: PROD_VERCEL_PROJECT_ID,
      VERCEL_GIT_COMMIT_REF: "main",
    });
    expect(build.status).toBe(1);

    const skip = runCli({
      VERCEL_PROJECT_ID: PROD_VERCEL_PROJECT_ID,
      VERCEL_GIT_COMMIT_REF: "rc/nov2",
    });
    expect(skip.status).toBe(0);
  });
});
