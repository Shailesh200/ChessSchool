import { readFileSync } from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => ({
  msedge: false,
  elevenSynth: vi.fn(async () => Buffer.from("eleven")),
  googleSynth: vi.fn(async () => Buffer.from("google")),
  edgeSynth: vi.fn(async () => Buffer.from("edge")),
}));

vi.mock("msedge-tts", () => {
  loaded.msedge = true;
  return {
    MsEdgeTTS: class {
      setMetadata = loaded.edgeSynth;
      toStream = loaded.edgeSynth;
    },
    OUTPUT_FORMAT: {},
  };
});

vi.mock("@/lib/tts/elevenlabs.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tts/elevenlabs.server")>();
  return {
    ...actual,
    synthesizeElevenLabsSpeech:
      loaded.elevenSynth as typeof actual.synthesizeElevenLabsSpeech,
  };
});

vi.mock("@/lib/tts/google.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tts/google.server")>();
  return {
    ...actual,
    synthesizeGoogleSpeech: loaded.googleSynth as typeof actual.synthesizeGoogleSpeech,
  };
});

vi.mock("@/lib/auth", () => ({
  getApiUser: vi.fn(async () => null),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

const webRoot = path.resolve(import.meta.dirname, "../../..");

type ModuleLoad = (
  this: unknown,
  request: string,
  parent: NodeJS.Module | null | undefined,
  isMain: boolean,
) => unknown;

const nodeModule = Module as unknown as { _load: ModuleLoad };
const originalLoad = nodeModule._load;
const required: string[] = [];

/** Edge Read Aloud lived in `msedge-tts` and `lib/tts/edge.server`. */
function isEdgeTtsSpecifier(id: string): boolean {
  const spec = id.replaceAll("\\", "/");
  if (spec === "msedge-tts" || spec.startsWith("msedge-tts/")) return true;
  if (/(^|\/)edge\.server(\.|$|\/)/.test(spec)) return true;
  const base = spec.split("/").pop() ?? spec;
  return (
    base === "edge" ||
    base === "edge.js" ||
    base === "edge.ts" ||
    base === "edge.mjs" ||
    base === "edge.cjs"
  );
}

const SPECIFIER_RE =
  /(?:import\s+(?:type\s+)?(?:[^'"\n]+?\s+from\s+)?|export\s+(?:type\s+)?[^'"\n]*?\sfrom\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

function specifiersIn(source: string): string[] {
  return [...source.matchAll(SPECIFIER_RE)].map((match) => match[1] ?? "");
}

function resolveLocal(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) return path.resolve(webRoot, spec.slice(2));
  if (spec.startsWith(".")) return path.resolve(path.dirname(fromFile), spec);
  return null;
}

/** Static import/require graph from the route. Missing files are still reported. */
function edgeImportsFrom(entry: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of specifiersIn(source)) {
      if (isEdgeTtsSpecifier(spec)) found.push(`${path.basename(file)} → ${spec}`);
      const local = resolveLocal(file, spec);
      if (!local || seen.has(local)) continue;
      const candidates = [
        local,
        `${local}.ts`,
        `${local}.tsx`,
        `${local}.mjs`,
        path.join(local, "index.ts"),
        path.join(local, "index.tsx"),
      ];
      const existing = candidates.find((candidate) => {
        try {
          readFileSync(candidate, "utf8");
          return true;
        } catch {
          return false;
        }
      });
      if (existing) queue.push(existing);
    }
  }
  return found;
}

describe("POST /api/tts", () => {
  const saved = {
    eleven: process.env.ELEVENLABS_API_KEY,
    google: process.env.GOOGLE_TTS_CREDENTIALS,
    provider: process.env.TTS_PROVIDER,
  };
  const routeFile = path.resolve(import.meta.dirname, "route.ts");

  beforeEach(() => {
    loaded.msedge = false;
    loaded.elevenSynth.mockClear();
    loaded.googleSynth.mockClear();
    loaded.edgeSynth.mockClear();
    required.length = 0;
    nodeModule._load = function (request, parent, isMain) {
      required.push(request);
      return originalLoad.call(this, request, parent, isMain);
    };
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.GOOGLE_TTS_CREDENTIALS;
    delete process.env.TTS_PROVIDER;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        throw new Error(`unexpected fetch ${String(input)}`);
      }),
    );
  });

  afterEach(() => {
    nodeModule._load = originalLoad;
    vi.unstubAllGlobals();
    if (saved.eleven === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = saved.eleven;
    if (saved.google === undefined) delete process.env.GOOGLE_TTS_CREDENTIALS;
    else process.env.GOOGLE_TTS_CREDENTIALS = saved.google;
    if (saved.provider === undefined) delete process.env.TTS_PROVIDER;
    else process.env.TTS_PROVIDER = saved.provider;
  });

  it("returns 503 and does not call a speech provider when none is configured", async () => {
    expect(isEdgeTtsSpecifier("msedge-tts")).toBe(true);
    expect(isEdgeTtsSpecifier("./edge.server")).toBe(true);
    expect(isEdgeTtsSpecifier("edge")).toBe(true);
    expect(edgeImportsFrom(routeFile)).toEqual([]);

    const { POST } = await import("@/app/api/tts/route");
    const res = await POST(
      new Request("http://test/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Good move.",
          character: "anxious_nerd",
          voice: "auto",
        }),
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "tts_unconfigured" });
    expect(loaded.elevenSynth).not.toHaveBeenCalled();
    expect(loaded.googleSynth).not.toHaveBeenCalled();
    expect(loaded.edgeSynth).not.toHaveBeenCalled();
    expect(loaded.msedge).toBe(false);
    expect(required.filter(isEdgeTtsSpecifier)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
