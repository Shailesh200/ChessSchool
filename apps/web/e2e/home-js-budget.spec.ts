import { test, expect, type Response } from "@playwright/test";

// Playwright compiles specs as CJS. Gzip and path normalization come from the
// budget helper; the script *set* below is what the browser actually requests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const homeJs = require("../../../scripts/lib/home-initial-js.cjs") as {
  HOME_JS_BUDGET_KB: number;
  gzipLength: (buf: Buffer) => number;
  scriptPathname: (url: string) => string;
  measureBuiltHome: () => {
    gzipBytes: number;
    kb: number;
    chunks: { url: string }[];
  };
};

/**
 * HTML-parser and preload requests are the document's first-load scripts.
 * Dynamic imports after hydration are initiator "script" and are not in the budget.
 */
const FIRST_LOAD_INITIATORS = new Set(["parser", "preload", "preloader"]);

type RequestWillBeSent = {
  type?: string;
  request: { url: string };
  initiator?: { type?: string };
};

function isLocalBaseUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function listDiff(expected: string[], actual: string[]) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((path) => !actualSet.has(path)).sort();
  const extra = [...actualSet].filter((path) => !expectedSet.has(path)).sort();
  return { missing, extra };
}

/**
 * The budget helper reads the local build. A remote BASE_URL is a different
 * deployment, so comparing it to this checkout's `.next` would be meaningless.
 */
test("home first-load JS matches the scripts the browser requests", async ({
  page,
  baseURL,
}) => {
  const configured = process.env.BASE_URL;
  test.skip(
    Boolean(configured && !isLocalBaseUrl(configured)),
    `Skipping home JS budget check: BASE_URL=${configured} is a remote preview. This spec compares the browser to the local .next build and does not read that build for a remote deployment.`,
  );

  const origin = new URL(baseURL ?? "http://localhost:3210").origin;
  const expected = homeJs.measureBuiltHome();
  const expectedPaths = expected.chunks.map((chunk) =>
    homeJs.scriptPathname(chunk.url),
  );

  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  const parserPaths = new Set<string>();
  client.on("Network.requestWillBeSent", (event: RequestWillBeSent) => {
    const initiator = event.initiator?.type;
    if (!initiator || !FIRST_LOAD_INITIATORS.has(initiator)) return;
    const url = event.request.url;
    if (event.type !== "Script" && !url.split("?")[0].endsWith(".js")) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.origin !== origin) return;
    parserPaths.add(homeJs.scriptPathname(url));
  });

  const bodies = new Map<string, Buffer>();
  const failed: string[] = [];
  const pending: Promise<void>[] = [];
  const readScript = async (response: Response) => {
    if (response.request().resourceType() !== "script") return;
    let parsed: URL;
    try {
      parsed = new URL(response.url());
    } catch {
      return;
    }
    if (parsed.origin !== origin) return;
    const pathname = homeJs.scriptPathname(response.url());
    if (!response.ok()) {
      failed.push(`${pathname} (${response.status()})`);
      return;
    }
    bodies.set(pathname, await response.body());
  };
  page.on("response", (response) => {
    pending.push(readScript(response));
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await Promise.all(pending);

  const actualPaths = [...parserPaths];
  const { missing, extra } = listDiff(expectedPaths, actualPaths);
  const mismatch = [
    missing.length
      ? `In the helper, not requested by the browser:\n${missing.map((path) => `  ${path}`).join("\n")}`
      : "",
    extra.length
      ? `Requested by the browser, not in the helper:\n${extra.map((path) => `  ${path}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  expect({ missing, extra }, mismatch || "first-load script sets match").toEqual({
    missing: [],
    extra: [],
  });

  const parserFailed = failed.filter((line) =>
    parserPaths.has(line.slice(0, line.lastIndexOf(" ("))),
  );
  expect(parserFailed, "first-load scripts that failed to load").toEqual([]);

  let fetchedGzip = 0;
  const missingBodies: string[] = [];
  for (const pathname of actualPaths) {
    const body = bodies.get(pathname);
    if (!body) {
      missingBodies.push(pathname);
      continue;
    }
    fetchedGzip += homeJs.gzipLength(body);
  }
  expect(missingBodies, "first-load scripts with no response body").toEqual([]);
  // zlib.gzipSync length is a function of the bytes only (the gzip mtime field
  // is fixed-width), so identical file bytes and response bodies match exactly.
  expect(fetchedGzip).toBe(expected.gzipBytes);
  expect(expected.kb).toBeLessThanOrEqual(homeJs.HOME_JS_BUDGET_KB);
});
