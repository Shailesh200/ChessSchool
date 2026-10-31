/**
 * Fail on prod-looking libsql URLs in tracked non-test sources, or hardcoded drizzle URLs.
 */

const PROD_LIBSQL = /libsql:\/\/chessschool/i;

/**
 * @param {string} path
 */
export function isTestLikePath(path) {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    path.includes(".integration.test.") ||
    /(?:^|\/)__tests__(?:\/|$)/.test(path) ||
    /(?:^|\/)fixtures?(?:\/|$)/.test(path)
  );
}

/**
 * @param {string} path
 * @param {string} content
 */
export function findProdLibsqlInFile(path, content) {
  if (isTestLikePath(path)) return [];
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (PROD_LIBSQL.test(lines[i])) {
      hits.push({ path, line: i + 1, kind: "prod-libsql-url" });
    }
  }
  return hits;
}

/**
 * @param {string} path
 * @param {string} content
 */
export function drizzleConfigHardcodesRemoteUrl(path, content) {
  if (!path.endsWith("drizzle.config.ts") && !path.endsWith("drizzle.config.js")) {
    return [];
  }
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("#")
    ) {
      continue;
    }
    if (/libsql:\/\//.test(line) && !/process\.env/.test(line)) {
      hits.push({ path, line: i + 1, kind: "hardcoded-drizzle-url" });
    }
  }
  return hits;
}
