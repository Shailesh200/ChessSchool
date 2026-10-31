/** chess-school (prod) — main only. */
export const PROD_VERCEL_PROJECT_ID = "prj_sPVUZXkR4j8UFcyoey4B5VX9A8Iq";

/** chess-school-test — rc/nov2 only. */
export const TEST_VERCEL_PROJECT_ID = "prj_WW0gV5TFjJvPiuC9PlvrznuZvEaA";

/**
 * Whether Vercel should run a build for this git push.
 * @returns {true} build (ignore step exit 1)
 * @returns {false} skip (ignore step exit 0)
 */
export function shouldBuildVercelDeployment(env) {
  const projectId = (env.VERCEL_PROJECT_ID ?? "").trim();
  const gitRef = (env.VERCEL_GIT_COMMIT_REF ?? "").trim();

  if (!projectId || !gitRef) return false;

  if (projectId === PROD_VERCEL_PROJECT_ID) return gitRef === "main";
  if (projectId === TEST_VERCEL_PROJECT_ID) return gitRef === "rc/nov2";

  return false;
}
