import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const flowsDir = path.join(repoRoot, "parity/maestro/flows/qa");
const guard = path.join(repoRoot, "scripts/qa-sim-flow-guard.py");
const purge = path.join(repoRoot, "scripts/qa-sim-purge-images.py");
// v9: the interpreter the workflow hands to qa-sim-maestro.sh as QA_SIM_PY (in the tests: the box python3, which has PyYAML)
const SYS_PY = spawnSync("bash", ["-c", "command -v python3"], {
  encoding: "utf8",
}).stdout.trim();

const SECRET_UNITS = [
  "m10-progress-save-reload",
  "m50-signin-persist",
  "m51-signup-enroll",
  "m11-offline-queue",
  "logout-isolation-1-pre-expiry",
  "logout-isolation-2-post-expiry",
];

function copyFlows(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "qa-flows-"));
  cpSync(flowsDir, dir, { recursive: true });
  return dir;
}

function run(dir: string, env: Record<string, string> = {}) {
  const r = spawnSync("python3", [guard, "--flows", dir], {
    encoding: "utf8",
    env: { ...process.env, ...env } as unknown as NodeJS.ProcessEnv,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function edit(file: string, fn: (text: string) => string) {
  writeFileSync(file, fn(readFileSync(file, "utf8")));
}

describe("qa-sim flow guard (fail closed: no screenshots from a unit that types a password)", () => {
  it("passes on the real flows and flags exactly the units that type a password", () => {
    const r = run(flowsDir);
    expect(r.out).toContain("flow guard: PASS");
    expect(r.code).toBe(0);
    const manifest = readFileSync(path.join(flowsDir, "manifest.tsv"), "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"));
    expect(manifest.filter((c) => c[3] === "yes").map((c) => c[0])).toEqual(
      SECRET_UNITS,
    );
    expect(manifest.every((c) => c[3] === "yes" || c[3] === "no")).toBe(true);
  });

  it("no flag drift: a unit that runs a password flow but is marked no fails", () => {
    const dir = copyFlows();
    edit(path.join(dir, "manifest.tsv"), (t) =>
      t.replace(/^(m10-progress-save-reload\t[^\t]*\t[^\t]*\t)yes/m, "$1no"),
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(
      /GUARD FAIL: unit m10-progress-save-reload: .*secret column is 'no'/,
    );
  });

  it("a new password input in a flow of an unflagged unit fails", () => {
    const dir = copyFlows();
    edit(
      path.join(dir, "m01-guest-launch-campus.yaml"),
      (t) => `${t}\n- inputText: \${MAESTRO_E2E_PASSWORD}\n`,
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/GUARD FAIL: unit m01-guest-launch-campus: .*not yes/);
  });

  it("a password reached only through a _common flow still counts", () => {
    const dir = copyFlows();
    edit(
      path.join(dir, "m15-lesson-step.yaml"),
      (t) => `${t}\n- runFlow: _common/sign-in-form.yaml\n`,
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/GUARD FAIL: unit m15-lesson-step: .*sign-in-form\.yaml/);
  });

  it("takeScreenshot or startRecording in a flagged unit's own flow fails", () => {
    for (const step of ["- takeScreenshot: leak", "- startRecording: leak"]) {
      const dir = copyFlows();
      edit(path.join(dir, "m50-signin-persist.yaml"), (t) => `${t}\n${step}\n`);
      const r = run(dir);
      expect(r.code).toBe(1);
      expect(r.out).toMatch(
        /GUARD FAIL: secret unit m50-signin-persist: m50-signin-persist\.yaml:\d+ has (takeScreenshot|startRecording)/,
      );
    }
  });

  it("takeScreenshot in a _common flow that a flagged unit runs fails", () => {
    const dir = copyFlows();
    edit(
      path.join(dir, "_common/sign-in-form.yaml"),
      (t) => `${t}\n- takeScreenshot: login\n`,
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(
      /GUARD FAIL: secret unit logout-isolation-1-pre-expiry: _common\/sign-in-form\.yaml:\d+ has takeScreenshot/,
    );
    expect(r.out).toMatch(
      /GUARD FAIL: flow _common\/sign-in-form\.yaml: .*screenshot\/recording step/,
    );
  });

  it("any flow with takeScreenshot in the same file as a password input fails, even outside the manifest", () => {
    const dir = copyFlows();
    writeFileSync(
      path.join(dir, "stray.yaml"),
      "appId: com.chessschool.app\n---\n- inputText: ${MAESTRO_E2E_PASSWORD}\n- takeScreenshot: stray\n",
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(
      /GUARD FAIL: flow stray\.yaml: stray\.yaml:\d+ has a screenshot\/recording step/,
    );
  });

  it("an unflagged flow without a password may keep its screenshots", () => {
    expect(
      readFileSync(path.join(flowsDir, "m01-guest-launch-campus.yaml"), "utf8"),
    ).toContain("takeScreenshot");
    expect(run(flowsDir).code).toBe(0);
  });

  it("follows runFlow includes recursively: a takeScreenshot in a sub-sub-flow of a _common file is caught", () => {
    const dir = copyFlows();
    writeFileSync(
      path.join(dir, "_common/deep.yaml"),
      "appId: x\n---\n- takeScreenshot: deep\n",
    );
    writeFileSync(
      path.join(dir, "_common/mid.yaml"),
      "appId: x\n---\n- runFlow:\n    file: deep.yaml\n",
    );
    edit(
      path.join(dir, "_common/finish-onboarding.yaml"),
      (t) => `${t}\n- runFlow: mid.yaml\n`,
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    // sign-in-form.yaml -> finish-onboarding.yaml -> mid.yaml -> deep.yaml
    expect(r.out).toMatch(
      /GUARD FAIL: secret unit logout-isolation-1-pre-expiry: _common\/deep\.yaml:\d+ has takeScreenshot/,
    );
    expect(r.out).toMatch(
      /GUARD FAIL: flow _common\/sign-in-form\.yaml: _common\/deep\.yaml:\d+ has a screenshot\/recording step/,
    );
  });

  it("assertWithAI / extractTextWithAI in a secret unit's flow or in any nested include fails (they send a screenshot to a remote model)", () => {
    for (const cmd of ["assertWithAI", "extractTextWithAI"]) {
      const own = copyFlows();
      edit(
        path.join(own, "m10-progress-save-reload.yaml"),
        (t) => `${t}\n- ${cmd}:\n    assertion: the page is shown\n`,
      );
      const a = run(own);
      expect(a.code, cmd).toBe(1);
      expect(a.out).toMatch(
        new RegExp(
          `GUARD FAIL: secret unit m10-progress-save-reload: m10-progress-save-reload\\.yaml:\\d+ has ${cmd}`,
        ),
      );
      const nested = copyFlows();
      writeFileSync(
        path.join(nested, "_common/deep.yaml"),
        `appId: x\n---\n- ${cmd}:\n    prompt: read it\n`,
      );
      writeFileSync(
        path.join(nested, "_common/mid.yaml"),
        "appId: x\n---\n- runFlow:\n    file: deep.yaml\n",
      );
      edit(
        path.join(nested, "_common/finish-onboarding.yaml"),
        (t) => `${t}\n- runFlow: mid.yaml\n`,
      );
      const b = run(nested);
      expect(b.code, cmd).toBe(1);
      expect(b.out).toMatch(
        new RegExp(
          `GUARD FAIL: secret unit logout-isolation-1-pre-expiry: _common/deep\\.yaml:\\d+ has ${cmd}`,
        ),
      );
    }
    // an unflagged unit without a password may still use them (the guard only protects units that type a password)
    const ok = copyFlows();
    edit(
      path.join(ok, "m01-guest-launch-campus.yaml"),
      (t) => `${t}\n- assertWithAI:\n    assertion: x\n`,
    );
    expect(run(ok).code).toBe(0);
  });

  it("case variants are caught (raw text layer is case-insensitive and the parsed YAML keys are compared in lower case)", () => {
    for (const cmd of [
      "TakeScreenshot",
      "ASSERTWITHAI",
      "extracttextwithai",
      "StartRecording",
    ]) {
      const dir = copyFlows();
      edit(
        path.join(dir, "m10-progress-save-reload.yaml"),
        (t) => `${t}\n- ${cmd}:\n    x: y\n`,
      );
      const r = run(dir);
      expect(r.code, cmd).toBe(1);
      expect(r.out, cmd).toMatch(
        /GUARD FAIL: secret unit m10-progress-save-reload: m10-progress-save-reload\.yaml:\d+ has (takeScreenshot|assertWithAI|extractTextWithAI|startRecording)/,
      );
    }
  });

  it("YAML-escaped, quoted and bare commands are caught by the parsed layer (yaml.safe_load decodes \\u escapes) even where no raw text matches", () => {
    const cases: Array<[string, RegExp]> = [
      ['- "\\u0061ssertWithAI":\n    assertion: x\n', /has assertWithAI/],
      ['- "\\u0054akeScreenshot": shot\n', /has takeScreenshot/],
      ['- "take\\x53creenshot": shot\n', /has takeScreenshot/],
      ['- "\\u0073topRecording"\n', /has stopRecording/],
      ['- &x\n  "\\u0065xtractTextWithAI": 1\n', /has extractTextWithAI/],
    ];
    for (const [yamlText, re] of cases) {
      const dir = copyFlows();
      edit(path.join(dir, "m10-progress-save-reload.yaml"), (t) => `${t}\n${yamlText}`);
      const r = run(dir);
      expect(r.code, yamlText).toBe(1);
      expect(r.out, yamlText).toMatch(re);
      expect(r.out, yamlText).toMatch(/parsed-yaml/);
    }
    // an escaped runFlow key and an escaped file key cannot hide an include
    const dir = copyFlows();
    writeFileSync(
      path.join(dir, "_common/deep.yaml"),
      "appId: x\n---\n- takeScreenshot: deep\n",
    );
    edit(
      path.join(dir, "_common/finish-onboarding.yaml"),
      (t) =>
        `${t}\n- "\\u0072unFlow": deep.yaml\n- "\\u0072unFlow":\n    "\\u0066ile": deep.yaml\n`,
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(
      /GUARD FAIL: secret unit logout-isolation-1-pre-expiry: _common\/deep\.yaml:\d+ has takeScreenshot/,
    );
  });

  it("the raw text layer is a second layer: a command hidden in a block scalar that the parsed keys do not see is still caught, in any case", () => {
    const dir = copyFlows();
    edit(
      path.join(dir, "m10-progress-save-reload.yaml"),
      (t) => `${t}\n- evalScript: |\n    Maestro.ASSERTWITHAI()\n`,
    );
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/m10-progress-save-reload\.yaml:\d+ has assertWithAI/);
    expect(r.out).not.toMatch(/parsed-yaml/);
  });

  it("a flow that yaml.safe_load cannot parse, or a missing PyYAML, fails closed", () => {
    const dir = copyFlows();
    edit(
      path.join(dir, "m01-guest-launch-campus.yaml"),
      (t) => `${t}\n- tapOn: [unclosed\n`,
    );
    const bad = run(dir);
    expect(bad.code).toBe(1);
    expect(bad.out).toMatch(
      /GUARD FAIL: .*m01-guest-launch-campus\.yaml: yaml\.safe_load cannot parse it/,
    );
    const noyaml = mkdtempSync(path.join(tmpdir(), "qa-noyaml-"));
    writeFileSync(
      path.join(noyaml, "yaml.py"),
      'raise ImportError("blocked for the test")\n',
    );
    const r = run(flowsDir, { PYTHONPATH: noyaml });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/GUARD FAIL: .*PyYAML .* is not installed/);
  });

  describe("v8: duplicate YAML keys fail the guard (custom SafeLoader; PyYAML would silently keep the last value)", () => {
    const m01 = "m01-guest-launch-campus.yaml";
    const cases: Array<[string, string, string]> = [
      [
        "a duplicate command key",
        "- takeScreenshot: a\n  takeScreenshot: b\n",
        "takeScreenshot",
      ],
      [
        "two `file:` keys in one runFlow (the guard would follow only the last)",
        "- runFlow:\n    file: _common/launch.yaml\n    file: _common/other.yaml\n",
        "file",
      ],
      ["a duplicate inside a flow-style map", "- tapOn: { id: a, id: b }\n", "id"],
      [
        "the same key written two ways (a double-quoted YAML escape decodes to the same key)",
        '- "takeScreenshot": a\n  "take\\x53creenshot": b\n',
        "takeScreenshot",
      ],
      [
        "a duplicate nested deeper",
        "- repeat:\n    times: 2\n    commands:\n      - tapOn:\n          id: a\n          id: b\n",
        "id",
      ],
    ];
    for (const [name, body, key] of cases) {
      it(`${name}: GUARD FAIL naming the key and both lines, exit 1`, () => {
        const dir = copyFlows();
        edit(path.join(dir, m01), (t) => `${t}\n${body}`);
        const r = run(dir);
        expect(r.code, r.out).toBe(1);
        expect(r.out).toMatch(
          new RegExp(
            `GUARD FAIL: .*${m01}: duplicate key '${key}' in one mapping \\(line \\d+ and line \\d+\\)`,
          ),
        );
      });
    }
    it("a duplicate key in a SECRET unit's flow, and in the second (command) document of the file, fails too", () => {
      const dir = copyFlows();
      edit(
        path.join(dir, "m10-progress-save-reload.yaml"),
        (t) => `${t}\n- tapOn:\n    id: x\n    id: y\n`,
      );
      const r = run(dir);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/m10-progress-save-reload\.yaml: duplicate key 'id'/);
    });
    it("the same key in DIFFERENT mappings, and an explicit key that overrides a `<<` merged one, are legal YAML and still PASS", () => {
      const dir = copyFlows();
      edit(
        path.join(dir, m01),
        (t) =>
          `${t}\n- tapOn: &b { id: a, text: t }\n- tapOn:\n    <<: *b\n    id: c\n- tapOn: { id: d }\n`,
      );
      const r = run(dir);
      expect(r.code, r.out).toBe(0);
      expect(r.out).toContain("flow guard: PASS");
    });
    it("the real flows have no duplicate keys (PASS), and the loader is the strict one in the script", () => {
      expect(run(flowsDir).code).toBe(0);
      const src = readFileSync(guard, "utf8");
      expect(src).toContain("class _StrictLoader(yaml.SafeLoader)");
      expect(src).toContain("Loader=_StrictLoader");
      expect(src).not.toMatch(/yaml\.safe_load_all\(/);
    });
  });

  it("a runFlow target that cannot be resolved fails (missing file, variable in the path, inline map, non-yaml target)", () => {
    for (const ref of [
      "- runFlow: _common/does-not-exist.yaml",
      "- runFlow:\n    file: _common/does-not-exist.yaml",
      "- runFlow: { file: _common/does-not-exist.yaml }",
      "- runFlow: _common/${WHICH}.yaml",
      "- runFlow: _common/sub.txt",
    ]) {
      const dir = copyFlows();
      edit(path.join(dir, "m01-guest-launch-campus.yaml"), (t) => `${t}\n${ref}\n`);
      const r = run(dir);
      expect(r.code, ref).toBe(1);
      expect(r.out, ref).toMatch(/does not exist|cannot be resolved/);
    }
  });

  it("a malformed manifest (bad secret value or a missing column) fails", () => {
    for (const mutate of [
      (t: string) =>
        t.replace(/^(m01-guest-launch-campus\t[^\t]*\t[^\t]*\t)no/m, "$1maybe"),
      (t: string) => t.replace(/^(m01-guest-launch-campus\t[^\t]*\t[^\t]*)\tno/m, "$1"),
    ]) {
      const dir = copyFlows();
      edit(path.join(dir, "manifest.tsv"), mutate);
      expect(run(dir).code).toBe(1);
    }
  });
});

describe("qa-sim image purge", () => {
  it("deletes images and videos (also renamed ones) and keeps text, then reports none left", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "qa-purge-"));
    const sub = path.join(dir, "unit/screens/screenshots");
    mkdirSync(sub, { recursive: true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    writeFileSync(path.join(dir, "unit/screenshot-❌-1-(flow).png"), png);
    writeFileSync(path.join(sub, "a.JPG"), "x");
    writeFileSync(path.join(sub, "b.webp"), "x");
    writeFileSync(path.join(sub, "c.mp4"), "x");
    writeFileSync(path.join(dir, "unit/renamed.bin"), png);
    writeFileSync(
      path.join(dir, "unit/noext"),
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]),
    );
    writeFileSync(path.join(dir, "unit/commands-1.json"), "{}");
    writeFileSync(path.join(dir, "unit/maestro.log"), "log");
    const r = spawnSync(
      "python3",
      [purge, path.join(dir, "unit"), path.join(dir, "missing-dir")],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("deleted 6 image/video file(s), 0 remain");
    expect(existsSync(path.join(dir, "unit/commands-1.json"))).toBe(true);
    expect(existsSync(path.join(dir, "unit/maestro.log"))).toBe(true);
    expect(existsSync(path.join(dir, "unit/renamed.bin"))).toBe(false);
    expect(existsSync(path.join(dir, "unit/noext"))).toBe(false);
  });
});

describe("qa-sim image purge --sweep (whole artifact folder)", () => {
  it("deletes images (by extension or content) outside the allowed dirs, keeps allowed ones, and exits 1 when it found any", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "qa-sweep-"));
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    for (const d of ["maestro/plain-a/screens", "maestro/sec-a", "junit"])
      mkdirSync(path.join(dir, d), { recursive: true });
    writeFileSync(path.join(dir, "maestro/plain-a/screens/ok.png"), png);
    writeFileSync(path.join(dir, "maestro/plain-a/noext"), png);
    writeFileSync(path.join(dir, "maestro/sec-a/shot.png"), png);
    writeFileSync(path.join(dir, "maestro/sec-a/renamed.txt"), png);
    writeFileSync(path.join(dir, "junit/loose"), png);
    writeFileSync(path.join(dir, "results.tsv"), "text");
    const r = spawnSync(
      "python3",
      [purge, "--sweep", dir, "--allow", path.join(dir, "maestro/plain-a")],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(10); // 10 = residue found and deleted (a crash of the script is 1, which the callers treat as a failed sweep)
    expect(r.stdout).toContain(
      "3 image/video file(s) outside the 1 allowed dir(s), 0 symlink(s), 0 remain",
    );
    expect(existsSync(path.join(dir, "maestro/plain-a/screens/ok.png"))).toBe(true);
    expect(existsSync(path.join(dir, "maestro/plain-a/noext"))).toBe(true);
    for (const f of [
      "maestro/sec-a/shot.png",
      "maestro/sec-a/renamed.txt",
      "junit/loose",
    ])
      expect(existsSync(path.join(dir, f)), f).toBe(false);
    expect(existsSync(path.join(dir, "results.tsv"))).toBe(true);
    // a second sweep finds nothing and exits 0
    expect(
      spawnSync(
        "python3",
        [purge, "--sweep", dir, "--allow", path.join(dir, "maestro/plain-a")],
        { encoding: "utf8" },
      ).status,
    ).toBe(0);
  });
});

describe("qa-sim image purge --sweep: symlinks", () => {
  it("deletes every symlink under the root (to a file, to a directory, broken, inside an allowed folder) and reports residue, without touching the targets", () => {
    const base = mkdtempSync(path.join(tmpdir(), "qa-links-"));
    const root = path.join(base, "root");
    const outside = path.join(base, "outside");
    mkdirSync(path.join(root, "maestro/plain-a"), { recursive: true });
    mkdirSync(outside);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    writeFileSync(path.join(outside, "secret.png"), png);
    writeFileSync(path.join(root, "maestro/plain-a/ok.png"), png);
    symlinkSync(
      path.join(outside, "secret.png"),
      path.join(root, "maestro/plain-a/link-to-image"),
    ); // inside the allowed folder: still a symlink
    symlinkSync(outside, path.join(root, "link-to-dir")); // os.walk would not follow this
    symlinkSync(path.join(base, "nowhere"), path.join(root, "broken"));
    symlinkSync("results.tsv", path.join(root, "link-to-text"));
    const r = spawnSync(
      "python3",
      [purge, "--sweep", root, "--allow", path.join(root, "maestro/plain-a")],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(10);
    expect(r.stdout).toContain("4 symlink(s)");
    const links = spawnSync("find", [root, "-type", "l"], {
      encoding: "utf8",
    }).stdout.trim();
    expect(links).toBe("");
    expect(existsSync(path.join(outside, "secret.png"))).toBe(true); // the target is not deleted, only the link
    expect(existsSync(path.join(root, "maestro/plain-a/ok.png"))).toBe(true);
    expect(
      spawnSync(
        "python3",
        [purge, "--sweep", root, "--allow", path.join(root, "maestro/plain-a")],
        { encoding: "utf8" },
      ).status,
    ).toBe(0);
  });
});

describe("qa-sim-maestro.sh: secret units run in a scratch cwd with absolute paths, then every image is purged", () => {
  const MAESTRO_STUB = `#!/usr/bin/env bash
{ echo "PWD=$PWD"; for a in "$@"; do echo "ARG=$a"; done; echo "END"; } >>"$STUB_LOG"
dbg=""; tod=""; prev=""
for a in "$@"; do
  case "$prev" in --debug-output) dbg="$a" ;; --test-output-dir) tod="$a" ;; esac
  prev="$a"
done
mkdir -p "$dbg/.maestro/tests/ts"
printf '\\x89PNG\\r\\n' >"$dbg/screenshot-FAILED-1.png"
printf 'x' >"$dbg/.maestro/tests/ts/SCREENSHOT-2.PNG"
printf 'x' >"$dbg/rec.MP4"
printf 'x' >"$dbg/commands-1.json"
printf '\\x89PNG\\r\\n\\x1a\\n' >"$dbg/noext-shot"                     # an image with no extension
printf '\\xff\\xd8\\xff\\xe0JFIF' >"$dbg/renamed-shot.txt"            # a renamed image
printf '\\x00\\x00\\x00\\x18ftypmp42' >"$dbg/clip.dat"
[ -z "\${STUB_LEAK:-}" ] || printf '\\x89PNG\\r\\n\\x1a\\n' >"$STUB_LEAK"   # an image written outside every unit folder
if [ -n "$tod" ]; then
  mkdir -p "$tod/screenshots"; printf 'x' >"$tod/screenshots/a.png"
else
  printf 'x' >./takeScreenshot-in-cwd.png     # takeScreenshot without --test-output-dir writes relative to the JVM cwd
  printf 'x' >./cwd-shot.JPEG
  printf '\\x89PNG\\r\\n\\x1a\\n' >./cwd-noext
fi
exit 0
`;

  function fixture(purgeBody?: string, extraEnv: Record<string, string> = {}) {
    const root = mkdtempSync(path.join(tmpdir(), "qa-runner-"));
    const sh = (args: string[], env: Record<string, string> = {}) =>
      spawnSync(args[0], args.slice(1), {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      });
    sh(["git", "init", "-q", "-b", "main", "."]);
    mkdirSync(path.join(root, "scripts"));
    for (const f of [
      "qa-sim-maestro.sh",
      "qa-sim-flow-guard.py",
      "qa-sim-purge-images.py",
    ]) {
      cpSync(path.join(repoRoot, "scripts", f), path.join(root, "scripts", f));
    }
    if (purgeBody !== undefined)
      writeFileSync(path.join(root, "scripts/qa-sim-purge-images.py"), purgeBody);
    const flows = path.join(root, "parity/maestro/flows/qa");
    mkdirSync(flows, { recursive: true });
    writeFileSync(path.join(flows, "sec.yaml"), "appId: x\n---\n- launchApp\n");
    writeFileSync(
      path.join(flows, "plain.yaml"),
      "appId: x\n---\n- launchApp\n- takeScreenshot: ok\n",
    );
    writeFileSync(
      path.join(flows, "manifest.tsv"),
      "sec-unit\tno\tsec.yaml\tyes\ttypes a password\nplain-unit\tno\tplain.yaml\tno\tno password\n",
    );
    const bin = mkdtempSync(path.join(tmpdir(), "qa-bin-"));
    writeFileSync(path.join(bin, "maestro"), MAESTRO_STUB);
    writeFileSync(path.join(bin, "adb"), "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(path.join(bin, "maestro"), 0o755);
    chmodSync(path.join(bin, "adb"), 0o755);
    const log = path.join(bin, "stub.log");
    const r = sh(["bash", "scripts/qa-sim-maestro.sh"], {
      PATH: `${bin}:${process.env.PATH}`,
      QA_DEVICE: "emulator-5554",
      QA_SERVER_OK: "0",
      QA_SIM_PY: SYS_PY,
      STUB_LOG: log,
      ...Object.fromEntries(
        Object.entries(extraEnv).map(([k, v]) => [
          k,
          v.replace("@ROOT@", realpathSync(root)),
        ]),
      ),
    });
    const calls = (existsSync(log) ? readFileSync(log, "utf8") : "")
      .split("END\n")
      .filter(Boolean)
      .map((c) => c.split("\n").filter(Boolean));
    const results = readFileSync(
      path.join(root, "qa-sim-artifacts/results.tsv"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\t"));
    return { root, r, calls, results };
  }

  // every file that is an image/video by extension OR by magic bytes
  function media(dir: string): string[] {
    const files = spawnSync("find", [dir, "-type", "f"], { encoding: "utf8" })
      .stdout.split("\n")
      .filter(Boolean);
    return files.filter((f) => {
      if (/\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i.test(f)) return true;
      const h = readFileSync(f).subarray(0, 12);
      return (
        h.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
        h.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
        h.subarray(4, 8).toString() === "ftyp"
      );
    });
  }

  function images(dir: string): string[] {
    const found = spawnSync(
      "find",
      [
        dir,
        "-type",
        "f",
        "(",
        "-iname",
        "*.png",
        "-o",
        "-iname",
        "*.jpg",
        "-o",
        "-iname",
        "*.jpeg",
        "-o",
        "-iname",
        "*.mp4",
        ")",
      ],
      { encoding: "utf8" },
    );
    return found.stdout.split("\n").filter(Boolean);
  }

  it("secret unit: scratch cwd (not the repo root), no --test-output-dir, absolute paths, 0 images; other unit keeps its images", () => {
    const { root, r, calls, results } = fixture();
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(results.map((x) => x.slice(0, 2))).toEqual([
      ["sec-unit", "PASS"],
      ["plain-unit", "PASS"],
    ]);
    const [sec, plain] = calls;
    const arg = (c: string[], k: string) =>
      c.find((x) => x.startsWith("ARG=")) &&
      c.filter((x) => x.startsWith("ARG=")).map((x) => x.slice(4));
    const secArgs = arg(sec, "")!;
    const plainArgs = arg(plain, "")!;
    const realRoot = realpathSync(root);
    // 2: secret unit runs in a fresh scratch folder, never the repo root, and the folder is removed afterwards
    const secCwd = sec[0].slice(4);
    expect(secCwd).not.toBe(realRoot);
    expect(secCwd.startsWith(realRoot)).toBe(false);
    expect(existsSync(secCwd)).toBe(false);
    expect(secArgs).not.toContain("--test-output-dir");
    // the unit that types no password runs in the repo root and does get --test-output-dir
    expect(plain[0].slice(4)).toBe(realRoot);
    expect(plainArgs).toContain("--test-output-dir");
    // absolute paths for the flow file, --output, --debug-output and --test-output-dir
    for (const [args, flow] of [
      [secArgs, "sec.yaml"],
      [plainArgs, "plain.yaml"],
    ] as const) {
      for (const flag of ["--output", "--debug-output", "--test-output-dir"]) {
        const i = args.indexOf(flag);
        if (i >= 0)
          expect(path.isAbsolute(args[i + 1]), `${flag} ${args[i + 1]}`).toBe(true);
      }
      const last = args[args.length - 1];
      expect(path.isAbsolute(last)).toBe(true);
      expect(last.endsWith(`/parity/maestro/flows/qa/${flow}`)).toBe(true);
    }
    // 3: no image or video left under the secret unit's folder; the scratch-cwd shots never reached the repo root or the artifact dir
    expect(images(path.join(root, "qa-sim-artifacts/maestro/sec-unit-sec"))).toEqual(
      [],
    );
    expect(images(root).filter((f) => !f.includes("/plain-unit-plain/"))).toEqual([]);
    // by content too: an image with no extension and a renamed image are gone, whatever their name
    expect(media(path.join(root, "qa-sim-artifacts/maestro/sec-unit-sec"))).toEqual([]);
    expect(media(root).filter((f) => !f.includes("/plain-unit-plain/"))).toEqual([]);
    for (const f of ["noext-shot", "renamed-shot.txt", "clip.dat"])
      expect(
        existsSync(path.join(root, "qa-sim-artifacts/maestro/sec-unit-sec", f)),
        f,
      ).toBe(false);
    expect(existsSync(path.join(root, "takeScreenshot-in-cwd.png"))).toBe(false);
    // text evidence of the secret unit is kept
    expect(
      existsSync(
        path.join(root, "qa-sim-artifacts/maestro/sec-unit-sec/commands-1.json"),
      ),
    ).toBe(true);
    // the other unit keeps its screenshots (debug dir and test-output dir)
    expect(
      images(path.join(root, "qa-sim-artifacts/maestro/plain-unit-plain")).length,
    ).toBe(4);
    expect(
      media(path.join(root, "qa-sim-artifacts/maestro/plain-unit-plain")).length,
    ).toBe(7); // + the extensionless, renamed and .dat ones: non-secret units keep them
    expect(results.length).toBe(2); // no __final-purge__ row: the final sweep found nothing
  });

  it("v9: QA_SIM_PY unset, empty or not executable: loud on stderr, every unit FAIL with the reason, no maestro call, exit 1 (never a silent fallback to the system python)", () => {
    for (const v of [
      "",
      "@ROOT@/nope/python",
      "@ROOT@/parity/maestro/flows/qa/manifest.tsv",
    ]) {
      const { r, calls, results } = fixture(undefined, { QA_SIM_PY: v });
      expect(r.status, v).toBe(1);
      expect(r.stderr, v).toContain("QA_SIM_PY is unset or not an executable file");
      expect(calls, v).toEqual([]);
      expect(
        results.map((x) => x.slice(0, 2)),
        v,
      ).toEqual([
        ["sec-unit", "FAIL"],
        ["plain-unit", "FAIL"],
      ]);
      for (const x of results) expect(x[2], v).toContain("QA_SIM_PY");
    }
  });

  it("if the purge leaves an image behind, the secret unit is FAIL with the reason and the run exits 1", () => {
    const { r, results } = fixture("#!/usr/bin/env python3\nimport sys\nsys.exit(0)\n"); // purge does nothing
    expect(r.status).toBe(1);
    expect(results[0][0]).toBe("sec-unit");
    expect(results[0][1]).toBe("FAIL");
    expect(results[0][2]).toMatch(
      /image\/video files remained under the secret unit's debug dir or scratch cwd after the purge/,
    );
    expect(results[1].slice(0, 2)).toEqual(["plain-unit", "PASS"]);
    // the final sweep (verified independently of the purge script) sees the residue as well
    expect(results[2].slice(0, 2)).toEqual(["__final-purge__", "FAIL"]);
    expect(results[2][2]).toMatch(/INCOMPLETE/);
  });

  it("final purge: a stray image (also one with no extension) outside the non-secret units' folders is deleted and FAILs the run", () => {
    for (const leak of [
      "@ROOT@/qa-sim-artifacts/junit/loose-noext",
      "@ROOT@/qa-sim-artifacts/stray.PNG",
      "@ROOT@/qa-sim-artifacts/maestro/sec-unit-sec-renamed.txt",
    ]) {
      const { root, r, results } = fixture(undefined, { STUB_LEAK: leak });
      const file = leak.replace("@ROOT@", realpathSync(root));
      expect(r.status, leak).toBe(1);
      expect(results.map((x) => x.slice(0, 2))).toEqual([
        ["sec-unit", "PASS"],
        ["plain-unit", "PASS"],
        ["__final-purge__", "FAIL"],
      ]);
      expect(results[2][2]).toMatch(
        /outside the non-secret units' folders.*INCOMPLETE/,
      );
      expect(existsSync(file), `${leak} is deleted`).toBe(false);
      expect(
        media(path.join(root, "qa-sim-artifacts/maestro/plain-unit-plain")).length,
      ).toBe(7); // the non-secret unit keeps its images
      expect(
        readFileSync(path.join(root, "qa-sim-artifacts/results.md"), "utf8"),
      ).toContain("INCOMPLETE");
    }
  });

  it("if the purge script itself fails, the secret unit is FAIL", () => {
    const { r, results } = fixture("#!/usr/bin/env python3\nimport sys\nsys.exit(1)\n");
    expect(r.status).toBe(1);
    expect(results[0].slice(0, 2)).toEqual(["sec-unit", "FAIL"]);
  });
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46]);
const MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
]);

// every file that is an image/video by extension OR by magic bytes
function mediaIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files = spawnSync("find", [dir, "-type", "f"], { encoding: "utf8" })
    .stdout.split("\n")
    .filter(Boolean);
  return files.filter((f) => {
    if (/\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i.test(f)) return true;
    const h = readFileSync(f).subarray(0, 12);
    return (
      h.subarray(0, 4).equals(PNG.subarray(0, 4)) ||
      h.subarray(0, 3).equals(JPG.subarray(0, 3)) ||
      h.subarray(4, 8).toString() === "ftyp"
    );
  });
}

describe("qa-sim-final-sweep.sh (the always() workflow step and the cleanup() trap)", () => {
  // a temp repo with the real sweep + purge scripts, a 2-unit manifest and an artifacts tree with images in every kind of place
  function sweepRepo(
    opts: { purgeBody?: string; noManifest?: boolean; noResults?: boolean } = {},
  ) {
    const root = mkdtempSync(path.join(tmpdir(), "qa-sweep-"));
    // hermetic: the sweep's fixed accounts path is ${TMPDIR}/qa-sim-accounts.env; a per-test TMPDIR OUTSIDE the temp repo, so no test can touch the real /tmp file
    const tmp = mkdtempSync(path.join(tmpdir(), "qa-sweep-tmp-"));
    mkdirSync(path.join(root, "scripts"));
    for (const f of [
      "qa-sim-final-sweep.sh",
      "qa-sim-accounts.sh",
      "qa-sim-purge-images.py",
      "qa-sim-scrub.py",
    ])
      cpSync(path.join(repoRoot, "scripts", f), path.join(root, "scripts", f));
    if (opts.purgeBody !== undefined)
      writeFileSync(path.join(root, "scripts/qa-sim-purge-images.py"), opts.purgeBody);
    const flows = path.join(root, "parity/maestro/flows/qa");
    mkdirSync(flows, { recursive: true });
    if (!opts.noManifest) {
      writeFileSync(
        path.join(flows, "manifest.tsv"),
        "sec-unit\tno\tsec.yaml\tyes\ttypes a password\nplain-unit\tno\tplain.yaml\tno\tno password\n",
      );
    }
    const art = path.join(root, "qa-sim-artifacts");
    const sec = path.join(art, "maestro/sec-unit-sec");
    const plain = path.join(art, "maestro/plain-unit-plain");
    mkdirSync(path.join(sec, ".maestro/tests/ts"), { recursive: true });
    mkdirSync(path.join(plain, "screens"), { recursive: true });
    mkdirSync(path.join(art, "junit"), { recursive: true });
    writeFileSync(path.join(sec, "screenshot-FAILED-1.png"), PNG);
    writeFileSync(path.join(sec, ".maestro/tests/ts/SCREENSHOT-2.PNG"), PNG);
    writeFileSync(path.join(sec, "noext-shot"), PNG);
    writeFileSync(path.join(sec, "renamed.txt"), JPG);
    writeFileSync(path.join(sec, "clip.dat"), MP4);
    writeFileSync(path.join(sec, "commands-1.json"), "{}");
    writeFileSync(path.join(plain, "screens/a.png"), PNG);
    writeFileSync(path.join(plain, "rec.mp4"), MP4);
    writeFileSync(path.join(plain, "commands-1.json"), "{}");
    writeFileSync(path.join(art, "junit/stray.JPG"), JPG);
    writeFileSync(path.join(art, "notes.txt"), "keep me");
    if (!opts.noResults) {
      writeFileSync(path.join(art, "results.tsv"), "plain-unit\tPASS\t\n");
      writeFileSync(path.join(art, "results.md"), "| plain-unit | PASS |\n");
    }
    return {
      root,
      art,
      sec,
      plain,
      tmp,
      accFile: path.join(tmp, "qa-sim-accounts.env"),
      env: (extra: Record<string, string> = {}) =>
        ({ ...process.env, TMPDIR: tmp, ...extra }) as unknown as NodeJS.ProcessEnv,
      sweep: (extra: Record<string, string> = {}) =>
        spawnSync("bash", ["scripts/qa-sim-final-sweep.sh"], {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            TMPDIR: tmp,
            ...extra,
          } as unknown as NodeJS.ProcessEnv,
        }),
    };
  }
  // v9 advisory A2: the EXIT trap. Inject a way out the TERM/INT/HUP traps do not cover right after the trap lines.
  const INJECT = (root: string, line: string) => {
    const f = path.join(root, "scripts/qa-sim-final-sweep.sh");
    const t = readFileSync(f, "utf8");
    const at = t.indexOf('HERE="$(cd');
    expect(at).toBeGreaterThan(0);
    writeFileSync(f, t.slice(0, at) + line + "\n" + t.slice(at));
  };
  it("A2 static: `trap 'finish \"$?\"' EXIT` is installed right with the TERM/INT/HUP traps, before anything that can fail", () => {
    const t = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-final-sweep.sh"),
      "utf8",
    );
    const code2 = t.replace(/^\s*#.*$/gm, "");
    expect(code2).toMatch(/^trap 'finish "\$\?"' EXIT\b/m);
    expect(code2.indexOf("trap 'finish \"$?\"' EXIT")).toBeLessThan(
      code2.indexOf('HERE="$(cd'),
    );
    expect(code2.indexOf("trap 'finish \"$?\"' EXIT")).toBeGreaterThan(
      code2.indexOf("trap 'finish 143' TERM"),
    );
  });
  it("A2: an unbound variable under set -u, an `exit 7` and a SIGUSR1 (none has its own trap) all still delete the accounts file, and `exit 7` stays 7; the control (no EXIT trap) leaves the file; a symlink at the accounts path is removed, never its target", () => {
    const cases: [string, (n: number | null) => boolean][] = [
      ['echo "$QA_NOT_SET_ZZ" >/dev/null', (n) => n !== null && n !== 0],
      ["exit 7", (n) => n === 7],
      ["kill -USR1 $$", () => true],
    ];
    for (const [line, ok] of cases) {
      const { root, accFile, sweep } = sweepRepo();
      writeFileSync(accFile, "E2E_EMAIL=a@b.c\nMAESTRO_A_PASSWORD=pw-not-real\n", {
        mode: 0o600,
      });
      INJECT(root, line);
      const r = sweep();
      expect(ok(r.status), `${line}: status ${r.status} ${r.stderr}`).toBe(true);
      expect(existsSync(accFile), line).toBe(false);
    }
    // control: the SAME injections against a copy WITHOUT the EXIT trap leave the file (so the check above can tell)
    for (const line of ["exit 7", 'echo "$QA_NOT_SET_ZZ" >/dev/null']) {
      const { root, accFile, sweep } = sweepRepo();
      writeFileSync(accFile, "E2E_EMAIL=a@b.c\nMAESTRO_A_PASSWORD=pw-not-real\n", {
        mode: 0o600,
      });
      const f = path.join(root, "scripts/qa-sim-final-sweep.sh");
      writeFileSync(
        f,
        readFileSync(f, "utf8").replace(/^trap 'finish "\$\?"' EXIT.*$/m, ""),
      );
      INJECT(root, line);
      sweep();
      expect(existsSync(accFile), `control ${line}`).toBe(true);
    }
    // a symlink at the accounts path: an exit through the EXIT trap removes the link itself, never its target
    const { root, tmp, accFile, sweep } = sweepRepo();
    const target = path.join(tmp, "target.txt");
    writeFileSync(target, "KEEP\n");
    symlinkSync(target, accFile);
    INJECT(root, "exit 7");
    expect(sweep().status).toBe(7);
    expect(existsSync(target)).toBe(true);
    expect(() => lstatSync(accFile)).toThrow();
  }, 120_000);
  const marker = (art: string) => {
    expect(readFileSync(path.join(art, "results.tsv"), "utf8")).toMatch(
      /^__final-purge__\tFAIL\t/m,
    );
    expect(readFileSync(path.join(art, "results.md"), "utf8")).toContain(
      "RUN VERDICT: INCOMPLETE",
    );
    expect(existsSync(path.join(art, "INCOMPLETE.txt"))).toBe(true);
  };

  it("clean tree (images only in the non-secret unit's folder): exit 0, nothing deleted, no marker", () => {
    const { art, sec, plain, sweep } = sweepRepo();
    spawnSync("bash", [
      "-c",
      `rm -rf ${JSON.stringify(sec)} ${JSON.stringify(path.join(art, "junit/stray.JPG"))}`,
    ]);
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(mediaIn(plain).length).toBe(3 - 1); // a.png and rec.mp4 are kept
    expect(existsSync(path.join(art, "INCOMPLETE.txt"))).toBe(false);
    expect(readFileSync(path.join(art, "results.tsv"), "utf8")).not.toContain(
      "__final-purge__",
    );
  });

  it("residue (secret unit's images in any form, a stray image, symlinks): all deleted, __final-purge__ FAIL, INCOMPLETE, exit 1; non-secret images kept", () => {
    const { art, sec, plain, sweep } = sweepRepo();
    symlinkSync(path.join(plain, "screens/a.png"), path.join(art, "link-to-png"));
    symlinkSync(path.join(art, "junit"), path.join(sec, "link-to-dir"));
    symlinkSync("/nonexistent/x", path.join(art, "broken"));
    expect(mediaIn(sec).length).toBe(5);
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(mediaIn(sec)).toEqual([]);
    expect(existsSync(path.join(art, "junit/stray.JPG"))).toBe(false);
    expect(
      spawnSync("find", [art, "-type", "l"], { encoding: "utf8" }).stdout.trim(),
    ).toBe("");
    expect(mediaIn(plain).length).toBe(2);
    expect(existsSync(path.join(sec, "commands-1.json"))).toBe(true); // text is kept
    marker(art);
    expect(
      JSON.stringify(
        JSON.parse(readFileSync(path.join(art, "results.json"), "utf8")).verdict,
      ),
    ).toBe('"INCOMPLETE"');
  });

  it("works when the killed run never wrote results.tsv / results.md (the marker files are created)", () => {
    const { art, sweep } = sweepRepo({ noResults: true });
    const r = sweep();
    expect(r.status).toBe(1);
    marker(art);
  });

  it("FALLBACK: the python sweep crashes (exit 1 traceback), exits 3, or exits 10 without its summary: ALL media is deleted (non-secret too), symlinks too, exit 1, marker", () => {
    const bodies: Record<string, string> = {
      crash: "import sys\nraise RuntimeError('boom')\n",
      exit3: "import sys\nsys.exit(3)\n",
      "exit10-no-summary": "import sys\nsys.exit(10)\n",
      exit11: "import sys\nprint('purge: sweep of x: 1 remain')\nsys.exit(11)\n",
      "noop-exit0": "import sys\nsys.exit(0)\n", // says success but deleted nothing: the independent shell check must notice
      "noop-exit10": "import sys\nprint('purge: sweep of x: 0 remain')\nsys.exit(10)\n",
      missing: "",
    };
    for (const [name, body] of Object.entries(bodies)) {
      const { root, art, plain, sec, sweep } = sweepRepo({ purgeBody: body });
      if (name === "missing") rmSync(path.join(root, "scripts/qa-sim-purge-images.py"));
      symlinkSync(path.join(plain, "screens/a.png"), path.join(art, "link"));
      const r = sweep();
      expect(r.status, name + r.stdout + r.stderr).toBe(1);
      expect(mediaIn(art), name).toEqual([]); // 0 media anywhere, the non-secret unit's included
      expect(
        spawnSync("find", [art, "-type", "l"], { encoding: "utf8" }).stdout.trim(),
        name,
      ).toBe("");
      expect(existsSync(path.join(sec, "commands-1.json")), name).toBe(true);
      marker(art);
      expect(readFileSync(path.join(art, "results.tsv"), "utf8"), name).toContain(
        "deleted ALL image/video files",
      );
    }
  });

  it("FALLBACK: the manifest cannot be read (missing) -> everything is deleted, exit 1, marker", () => {
    const { art, sweep } = sweepRepo({ noManifest: true });
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(mediaIn(art)).toEqual([]);
    marker(art);
  });

  it("FALLBACK works without python on PATH (plain shell: find, head, od, tr)", () => {
    const { art, sweep: _s, root, tmp: tmp0 } = sweepRepo();
    const bin = mkdtempSync(path.join(tmpdir(), "qa-nopy-"));
    for (const t of [
      "bash",
      "find",
      "head",
      "od",
      "tr",
      "rm",
      "cat",
      "dirname",
      "printf",
      "grep",
      "mkdir",
      "env",
      "readlink",
    ]) {
      const w = spawnSync("bash", ["-c", `command -v ${t}`], {
        encoding: "utf8",
      }).stdout.trim();
      if (w) symlinkSync(w, path.join(bin, t));
    }
    const r = spawnSync("/bin/bash", ["scripts/qa-sim-final-sweep.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: bin, TMPDIR: tmp0 } as unknown as NodeJS.ProcessEnv,
    });
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(mediaIn(art)).toEqual([]);
    marker(art);
  });

  it("after a SIGKILL the accounts file is still there: the sweep scrubs the artifacts with it and deletes it (the e2e trap could not)", () => {
    const { root, art, plain, tmp, accFile } = sweepRepo();
    spawnSync("bash", [
      "-c",
      `rm -rf ${JSON.stringify(path.join(art, "maestro/sec-unit-sec"))} ${JSON.stringify(path.join(art, "junit"))}`,
    ]);
    const pw = "Zx9-throwaway-pw-12345";
    writeFileSync(accFile, `E2E_EMAIL=a@b.c\nMAESTRO_A_PASSWORD=${pw}\n`);
    writeFileSync(path.join(plain, "maestro.log"), `inputText: ${pw}\n`);
    const r = spawnSync("bash", ["scripts/qa-sim-final-sweep.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, TMPDIR: tmp } as unknown as NodeJS.ProcessEnv,
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(readFileSync(path.join(plain, "maestro.log"), "utf8")).not.toContain(pw);
    expect(readFileSync(path.join(plain, "maestro.log"), "utf8")).toContain(
      "[scrubbed]",
    );
    expect(existsSync(accFile)).toBe(false);
  });

  it("no qa-sim-artifacts folder at all: nothing to do, exit 0", () => {
    const { root, art, sweep } = sweepRepo();
    rmSync(art, { recursive: true });
    expect(sweep().status).toBe(0);
    expect(existsSync(path.join(root, "qa-sim-artifacts"))).toBe(false);
  });

  // ---- v8: the accounts file (fixed path ${TMPDIR:-/tmp}/qa-sim-accounts.env) is ALWAYS deleted, and it is the sweep's last action ----
  it("v8 (a): the artifacts folder is MISSING and the accounts file exists: the file is deleted anyway (the accounts block runs before the early exit), exit 0", () => {
    const { root, art, accFile, sweep } = sweepRepo();
    rmSync(art, { recursive: true });
    writeFileSync(
      accFile,
      "E2E_EMAIL=a@b.c\nMAESTRO_A_PASSWORD=Zx9-throwaway-pw-12345\n",
    );
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("does not exist: nothing to sweep");
    expect(existsSync(accFile)).toBe(false);
    expect(existsSync(path.join(root, "qa-sim-artifacts"))).toBe(false);
  });

  it("v8 (a): the artifacts folder is missing and a SYMLINK sits at the accounts path: refused (never read), the link itself is deleted, the target is untouched, exit 1", () => {
    const { art, accFile, tmp, sweep } = sweepRepo();
    rmSync(art, { recursive: true });
    const victim = path.join(tmp, "victim.txt");
    writeFileSync(victim, "do not touch\n");
    symlinkSync(victim, accFile);
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stderr).toMatch(/FAIL: .*symlink/);
    expect(existsSync(accFile) || lstatExists(accFile)).toBe(false);
    expect(readFileSync(victim, "utf8")).toBe("do not touch\n");
  });

  it("v8 (b): a planted symlink with artifacts present: the artifacts are NOT scrubbed with the target's content (it was not read), the run is INCOMPLETE, the link is gone, the target survives", () => {
    const { art, plain, accFile, tmp, sweep } = sweepRepo();
    const victim = path.join(tmp, "victim.env");
    const pw = "Qq7-planted-target-pw";
    writeFileSync(victim, `MAESTRO_A_PASSWORD=${pw}\n`);
    symlinkSync(victim, accFile);
    writeFileSync(path.join(plain, "maestro.log"), `inputText: ${pw}\n`);
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(readFileSync(path.join(plain, "maestro.log"), "utf8")).toContain(pw); // proof the symlink target was never read
    expect(readFileSync(path.join(art, "results.tsv"), "utf8")).toMatch(
      /^__final-purge__\tFAIL\t.*symlink/m,
    );
    expect(lstatExists(accFile)).toBe(false);
    expect(readFileSync(victim, "utf8")).toContain(pw);
  });

  it("v8 (b): a dangling symlink and a directory at the accounts path are also handled: never read, link removed, exit 1", () => {
    const { art, accFile, tmp, sweep } = sweepRepo();
    rmSync(art, { recursive: true });
    symlinkSync(path.join(tmp, "nowhere"), accFile);
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(lstatExists(accFile)).toBe(false);
  });

  it("v8 (c): the location rule: TMPDIR resolving INSIDE the repo fails the sweep, and the file is still deleted", () => {
    const { root, art, sweep } = sweepRepo();
    rmSync(art, { recursive: true });
    const inRepo = path.join(root, "scratch");
    mkdirSync(inRepo);
    const f = path.join(inRepo, "qa-sim-accounts.env");
    writeFileSync(f, "MAESTRO_A_PASSWORD=Zx9\n");
    const r = sweep({ TMPDIR: inRepo });
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stderr).toMatch(/FAIL: .*inside the repo/);
    expect(existsSync(f)).toBe(false);
  });

  it("v8 (c): the location rule: TMPDIR inside qa-sim-artifacts/ (it would be uploaded) fails the sweep with a FAIL marker, the file is deleted and never scrubbed-from", () => {
    const { art, plain, sweep } = sweepRepo();
    const inArt = path.join(art, "tmp-here");
    mkdirSync(inArt);
    const f = path.join(inArt, "qa-sim-accounts.env");
    const pw = "Zx9-inside-artifacts-pw";
    writeFileSync(f, `MAESTRO_A_PASSWORD=${pw}\n`);
    writeFileSync(path.join(plain, "maestro.log"), `inputText: ${pw}\n`);
    const r = sweep({ TMPDIR: inArt });
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(readFileSync(path.join(art, "results.tsv"), "utf8")).toMatch(
      /^__final-purge__\tFAIL\t.*(inside the repo|artifact folder)/m,
    );
    expect(existsSync(f)).toBe(false);
  });

  it("v8 (c): the location rule is on the PHYSICAL path: a TMPDIR that is a symlink into the repo is refused too", () => {
    const { root, art, tmp, sweep } = sweepRepo();
    rmSync(art, { recursive: true });
    const real = path.join(root, "real-dir");
    mkdirSync(real);
    const viaLink = path.join(tmp, "link-into-repo");
    symlinkSync(real, viaLink);
    writeFileSync(path.join(real, "qa-sim-accounts.env"), "X=1\n");
    const r = sweep({ TMPDIR: viaLink });
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(existsSync(path.join(real, "qa-sim-accounts.env"))).toBe(false);
  });

  it("v8 (b): the delete is the LAST action on the other paths out too: residue found (exit 1), python crash + shell fallback (exit 1), clean (exit 0)", () => {
    for (const body of [undefined, "raise RuntimeError('boom')\n"]) {
      const { accFile, sweep } = sweepRepo(body ? { purgeBody: body } : {});
      writeFileSync(accFile, "MAESTRO_A_PASSWORD=Zx9-zz\n");
      const r = sweep();
      expect(r.status, r.stdout + r.stderr).toBe(1);
      expect(existsSync(accFile)).toBe(false);
    }
    const { art, sec, accFile, sweep } = sweepRepo();
    spawnSync("bash", [
      "-c",
      `rm -rf ${JSON.stringify(sec)} ${JSON.stringify(path.join(art, "junit/stray.JPG"))}`,
    ]);
    writeFileSync(accFile, "MAESTRO_A_PASSWORD=Zx9-zz\n");
    const r = sweep();
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(existsSync(accFile)).toBe(false);
  });

  it("v8 (b): the sweep is killed (SIGTERM to its group) while the python purge hangs: the accounts file is still deleted", async () => {
    const { root, accFile, env } = sweepRepo({
      purgeBody: "import time\ntime.sleep(300)\n",
    });
    writeFileSync(accFile, "MAESTRO_A_PASSWORD=Zx9-zz\n");
    const child = spawn("bash", ["scripts/qa-sim-final-sweep.sh"], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      env: env(),
    });
    const exited = new Promise<{ code: number | null; sig: string | null }>((res) =>
      child.on("exit", (code, sig) => res({ code, sig })),
    );
    await new Promise((r) => setTimeout(r, 1500));
    expect(existsSync(accFile), "still there while the sweep runs").toBe(true);
    (process as unknown as NodeJS.Process).kill(-child.pid!, "SIGTERM");
    const ex = await exited;
    expect(ex.code === 0, JSON.stringify(ex)).toBe(false);
    expect(existsSync(accFile)).toBe(false);
  }, 30000);

  it("v8 (b): static: the accounts block is above the missing-artifacts early exit, and the only `exit` in the sweep is inside finish() (the delete is the last action of every path)", () => {
    const src = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-final-sweep.sh"),
      "utf8",
    );
    const code = src
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    const early = code.indexOf('[ -d "$OUT" ] || {');
    expect(early).toBeGreaterThan(-1);
    expect(code.indexOf("qa_acc_location_ok")).toBeGreaterThan(-1);
    expect(code.indexOf("qa_acc_location_ok")).toBeLessThan(early);
    expect(code.indexOf('[ -L "$ACC" ]')).toBeLessThan(early);
    expect(code.indexOf("qa-sim-scrub.py")).toBeLessThan(early);
    const fin = code.slice(
      code.indexOf("finish() {"),
      code.indexOf("\n}\n", code.indexOf("finish() {")),
    );
    expect(fin).toContain('rm -f -- "$ACC"');
    expect(fin.indexOf('rm -f -- "$ACC"')).toBeLessThan(fin.indexOf("exit "));
    const rest = code.replace(fin, "");
    expect(rest.replace(/"[^"\n]*"/g, '""').match(/\bexit\b/g) ?? []).toEqual([]); // every other path goes through finish
    expect(code.match(/\brm -f -- "\$ACC"/g)?.length).toBe(1);
  });
});

function lstatExists(f: string): boolean {
  return spawnSync("test", ["-L", f]).status === 0 || existsSync(f);
}

describe("qa-sim-accounts.sh: the accounts file writer (mktemp 0600 in the same dir, atomic mv; refuses a symlink, a foreign or non-regular file, and a path inside the repo or the artifact folder)", () => {
  function setup() {
    const root = mkdtempSync(path.join(tmpdir(), "qa-accw-repo-"));
    mkdirSync(path.join(root, "scripts"));
    mkdirSync(path.join(root, "qa-sim-artifacts"));
    cpSync(
      path.join(repoRoot, "scripts/qa-sim-accounts.sh"),
      path.join(root, "scripts/qa-sim-accounts.sh"),
    );
    const tmp = mkdtempSync(path.join(tmpdir(), "qa-accw-tmp-"));
    const create = (p: string) =>
      spawnSync(
        "bash",
        [
          "-c",
          '. scripts/qa-sim-accounts.sh; qa_acc_create "$1" "$PWD" qa-sim-artifacts; rc=$?; echo "WHY=$QA_ACC_WHY"; exit $rc',
          "x",
          p,
        ],
        { cwd: root, encoding: "utf8" },
      );
    const leftovers = (dir: string) =>
      spawnSync("bash", ["-c", `ls -A ${JSON.stringify(dir)}`], {
        encoding: "utf8",
      })
        .stdout.split("\n")
        .filter((n) => n.startsWith(".qa-sim-accounts."));
    return { root, tmp, create, leftovers };
  }
  const mode = (f: string) => statSync(f).mode & 0o777;

  it("creates the file: regular, mode 0600, owned by us, empty, no temp file left behind", () => {
    const { tmp, create, leftovers } = setup();
    const f = path.join(tmp, "qa-sim-accounts.env");
    const r = create(f);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const st = lstatSync(f);
    expect(st.isFile() && !st.isSymbolicLink()).toBe(true);
    expect(mode(f)).toBe(0o600);
    expect(st.uid).toBe(statSync(tmp).uid); // tmp was made by this process, so its owner is us
    expect(st.size).toBe(0);
    expect(leftovers(tmp)).toEqual([]);
  });

  it("replaces an existing regular file ATOMICALLY (a new inode) and forces 0600 even if the old one was 0644", () => {
    const { tmp, create } = setup();
    const f = path.join(tmp, "qa-sim-accounts.env");
    writeFileSync(f, "OLD=1\n");
    chmodSync(f, 0o644);
    const before = statSync(f).ino;
    const r = create(f);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(statSync(f).ino).not.toBe(before);
    expect(mode(f)).toBe(0o600);
    expect(readFileSync(f, "utf8")).toBe("");
  });

  it("REFUSES a planted symlink (dangling or to a file): the target is untouched, the link is left for the sweep to delete, nothing is written", () => {
    const { tmp, create, leftovers } = setup();
    const f = path.join(tmp, "qa-sim-accounts.env");
    const victim = path.join(tmp, "victim");
    writeFileSync(victim, "keep\n");
    chmodSync(victim, 0o644);
    symlinkSync(victim, f);
    let r = create(f);
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stdout).toMatch(/WHY=.*symlink/);
    expect(lstatSync(f).isSymbolicLink()).toBe(true);
    expect(readFileSync(victim, "utf8")).toBe("keep\n");
    expect(mode(victim)).toBe(0o644);
    rmSync(f);
    symlinkSync(path.join(tmp, "dangling"), f);
    r = create(f);
    expect(r.status).toBe(1);
    expect(existsSync(path.join(tmp, "dangling"))).toBe(false); // a refusal never creates the target
    expect(leftovers(tmp)).toEqual([]);
  });

  it("REFUSES a path that exists but is not a regular file (a directory)", () => {
    const { tmp, create } = setup();
    const f = path.join(tmp, "qa-sim-accounts.env");
    mkdirSync(f);
    const r = create(f);
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stdout).toMatch(/WHY=.*not a regular file/);
  });

  it("REFUSES a path inside the repo, inside qa-sim-artifacts/, or reached through a symlinked directory that lands there; and a missing directory", () => {
    const { root, tmp, create } = setup();
    mkdirSync(path.join(root, "scratch"));
    for (const dir of [
      path.join(root, "scratch"),
      path.join(root, "qa-sim-artifacts"),
    ]) {
      const r = create(path.join(dir, "qa-sim-accounts.env"));
      expect(r.status, r.stdout + r.stderr).toBe(1);
      expect(existsSync(path.join(dir, "qa-sim-accounts.env"))).toBe(false);
    }
    const link = path.join(tmp, "dirlink");
    symlinkSync(path.join(root, "qa-sim-artifacts"), link);
    const viaLink = create(path.join(link, "qa-sim-accounts.env"));
    expect(viaLink.status, viaLink.stdout + viaLink.stderr).toBe(1);
    expect(viaLink.stdout).toMatch(
      /WHY=.*(inside the artifact folder|inside the repo)/,
    );
    expect(existsSync(path.join(root, "qa-sim-artifacts/qa-sim-accounts.env"))).toBe(
      false,
    );
    const missing = create(path.join(tmp, "no-such-dir", "qa-sim-accounts.env"));
    expect(missing.status).toBe(1);
  });

  it("qa-sim-e2e-android.sh: sources the helper and creates the file ONLY through qa_acc_create, before provisioning, and a refusal fails every unit and exits 1", () => {
    const src = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-e2e-android.sh"),
      "utf8",
    );
    const code = src
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    expect(code).toContain('ACC_PATH="${TMPDIR:-/tmp}/qa-sim-accounts.env"');
    expect(code).toContain("qa-sim-accounts.sh");
    expect(code).toMatch(
      /if ! qa_acc_create "\$ACC_PATH" "\$ROOT" "\$OUT"; then[^\n]*\n[^\n]*fail_all[^\n]*exit 1/,
    );
    expect(code.indexOf("qa_acc_create")).toBeLessThan(
      code.indexOf("qa-sim-api.py provision"),
    );
    expect(code).not.toMatch(/: >"\$ACC_ENV"/); // the old non-atomic create is gone
    expect(code).not.toMatch(/>\s*"\$ACC_PATH"/);
  });
});

describe("a run killed during a secret unit leaves 0 secret-unit images before the upload", () => {
  const STUB = `#!/usr/bin/env bash
dbg=""; tod=""; prev=""; flow=""
for a in "$@"; do
  case "$prev" in --debug-output) dbg="$a" ;; --test-output-dir) tod="$a" ;; esac
  case "$a" in *.yaml) flow="$a" ;; esac
  prev="$a"
done
mkdir -p "$dbg/.maestro/tests/ts"
printf '\\x89PNG\\r\\n\\x1a\\n' >"$dbg/screenshot-FAILED-1.png"
printf '\\x89PNG\\r\\n\\x1a\\n' >"$dbg/noext-shot"
printf '\\xff\\xd8\\xff\\xe0JFIF' >"$dbg/renamed-shot.txt"
[ -z "$tod" ] || { mkdir -p "$tod/screenshots"; printf 'x' >"$tod/screenshots/a.png"; }
case "$flow" in *sec.yaml) : >"$STUB_READY"; exec sleep 600 ;; esac
exit 0
`;
  // plain-unit runs first (its images must survive), then sec-unit hangs
  function hung() {
    const root = mkdtempSync(path.join(tmpdir(), "qa-kill-"));
    spawnSync("git", ["init", "-q", "-b", "main", "."], { cwd: root });
    mkdirSync(path.join(root, "scripts"));
    for (const f of [
      "qa-sim-maestro.sh",
      "qa-sim-flow-guard.py",
      "qa-sim-purge-images.py",
      "qa-sim-final-sweep.sh",
      "qa-sim-accounts.sh",
      "qa-sim-scrub.py",
    ])
      cpSync(path.join(repoRoot, "scripts", f), path.join(root, "scripts", f));
    const flows = path.join(root, "parity/maestro/flows/qa");
    mkdirSync(flows, { recursive: true });
    writeFileSync(path.join(flows, "sec.yaml"), "appId: x\n---\n- launchApp\n");
    writeFileSync(
      path.join(flows, "plain.yaml"),
      "appId: x\n---\n- launchApp\n- takeScreenshot: ok\n",
    );
    writeFileSync(
      path.join(flows, "manifest.tsv"),
      "plain-unit\tno\tplain.yaml\tno\tno password\nsec-unit\tno\tsec.yaml\tyes\ttypes a password\n",
    );
    // the e2e script's REAL cleanup() trap function, wrapped around the runner exactly like the e2e script does
    const e2e = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-e2e-android.sh"),
      "utf8",
    );
    const cleanup = e2e.slice(
      e2e.indexOf("cleanup() {"),
      e2e.indexOf("\n}\n", e2e.indexOf("cleanup() {")) + 3,
    );
    writeFileSync(
      path.join(root, "wrap.sh"),
      `#!/usr/bin/env bash\nset -uo pipefail\nOUT=qa-sim-artifacts; SERVER_PID=""; ACC_ENV=""\nmkdir -p "$OUT"\n${cleanup}trap cleanup EXIT\nbash scripts/qa-sim-maestro.sh\nrc=$?\nexit "$rc"\n`,
    );
    const bin = mkdtempSync(path.join(tmpdir(), "qa-bin-"));
    writeFileSync(path.join(bin, "maestro"), STUB);
    writeFileSync(path.join(bin, "adb"), "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(path.join(bin, "maestro"), 0o755);
    chmodSync(path.join(bin, "adb"), 0o755);
    const ready = path.join(bin, "ready");
    const tmp = mkdtempSync(path.join(tmpdir(), "qa-kill-tmp-")); // hermetic accounts-file dir (outside the repo)
    const child = spawn("bash", ["wrap.sh"], {
      cwd: root,
      detached: true, // its own process group, so the whole tree can be signalled like EAS killing the step
      stdio: "ignore",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        QA_DEVICE: "emulator-5554",
        QA_SERVER_OK: "0",
        QA_SIM_PY: SYS_PY,
        STUB_READY: ready,
        TMPDIR: tmp,
      } as unknown as NodeJS.ProcessEnv,
    });
    const exited = new Promise<{ code: number | null; sig: string | null }>((res) =>
      child.on("exit", (code, sig) => res({ code, sig })),
    );
    const art = path.join(root, "qa-sim-artifacts");
    return {
      root,
      tmp,
      art,
      child,
      exited,
      ready,
      sec: path.join(art, "maestro/sec-unit-sec"),
      plain: path.join(art, "maestro/plain-unit-plain"),
    };
  }
  async function untilReady(ready: string) {
    for (let i = 0; i < 200 && !existsSync(ready); i++)
      await new Promise((r) => setTimeout(r, 100));
    expect(existsSync(ready), "the stub reached the secret unit").toBe(true);
  }
  const killGroup = (pid: number, sig: NodeJS.Signals) =>
    (process as unknown as NodeJS.Process).kill(-pid, sig);

  it("SIGTERM to the run during the secret unit: the e2e cleanup() trap sweeps; 0 secret-unit images, marker, non-zero exit", async () => {
    const h = hung();
    await untilReady(h.ready);
    expect(
      mediaIn(h.sec).length,
      "secret images exist before the kill",
    ).toBeGreaterThan(0);
    killGroup(h.child.pid!, "SIGTERM");
    const ex = await h.exited;
    expect(ex.code === 0, JSON.stringify(ex)).toBe(false);
    expect(mediaIn(h.sec)).toEqual([]);
    expect(readFileSync(path.join(h.art, "results.tsv"), "utf8")).toMatch(
      /^__final-purge__\tFAIL\t/m,
    );
    expect(existsSync(path.join(h.art, "INCOMPLETE.txt"))).toBe(true);
    expect(mediaIn(h.plain).length).toBeGreaterThan(0); // the non-secret unit's images are kept
  }, 30000);

  it("SIGKILL to the run during the secret unit: no trap can run, images are left; the workflow always() step (the sweep script) then removes them: 0 secret-unit images, marker, exit 1", async () => {
    const h = hung();
    await untilReady(h.ready);
    killGroup(h.child.pid!, "SIGKILL");
    const ex = await h.exited;
    expect(ex.sig).toBe("SIGKILL");
    expect(
      mediaIn(h.sec).length,
      "SIGKILL leaves the secret images behind",
    ).toBeGreaterThan(0);
    const r = spawnSync("bash", ["scripts/qa-sim-final-sweep.sh"], {
      cwd: h.root,
      encoding: "utf8",
      env: { ...process.env, TMPDIR: h.tmp } as unknown as NodeJS.ProcessEnv,
    });
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(mediaIn(h.sec)).toEqual([]);
    expect(readFileSync(path.join(h.art, "results.tsv"), "utf8")).toMatch(
      /^__final-purge__\tFAIL\t/m,
    );
    expect(readFileSync(path.join(h.art, "results.md"), "utf8")).toContain(
      "RUN VERDICT: INCOMPLETE",
    );
    expect(mediaIn(h.plain).length).toBeGreaterThan(0);
  }, 30000);

  it("SIGKILL plus a CRASHING sweep: the shell fallback still leaves 0 media (secret or not) and the run fails", async () => {
    const h = hung();
    await untilReady(h.ready);
    killGroup(h.child.pid!, "SIGKILL");
    await h.exited;
    writeFileSync(
      path.join(h.root, "scripts/qa-sim-purge-images.py"),
      "raise RuntimeError('boom')\n",
    );
    const r = spawnSync("bash", ["scripts/qa-sim-final-sweep.sh"], {
      cwd: h.root,
      encoding: "utf8",
      env: { ...process.env, TMPDIR: h.tmp } as unknown as NodeJS.ProcessEnv,
    });
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(mediaIn(h.art)).toEqual([]);
    expect(readFileSync(path.join(h.art, "results.tsv"), "utf8")).toMatch(
      /^__final-purge__\tFAIL\t/m,
    );
  }, 30000);
});

describe("qa-sim-mobile.yml: the final sweep step", () => {
  const wf = readFileSync(
    path.join(repoRoot, "apps/mobile/.eas/workflows/qa-sim-mobile.yml"),
    "utf8",
  );
  const e2e = wf.slice(wf.indexOf("e2e_android:"));
  const steps = e2e.split(/\n {6}- /).slice(1);
  const idx = (needle: string) => steps.findIndex((s) => s.includes(needle));
  it("exists in the e2e job, has if: always(), cds to the repo top level fail-loud, and runs between the e2e step and the check and upload steps", () => {
    const sweep = idx("qa-sim-final-sweep.sh");
    expect(sweep).toBeGreaterThan(-1);
    expect(steps[sweep]).toMatch(/if: \$\{\{ always\(\) \}\}/);
    expect(steps[sweep]).toContain(
      'top=$(git rev-parse --show-toplevel) && cd "$top" || exit 1',
    );
    expect(sweep).toBeGreaterThan(idx("qa-sim-e2e-android.sh"));
    expect(sweep).toBeLessThan(idx("find qa-sim-artifacts"));
    expect(sweep).toBeLessThan(idx("eas/upload_artifact"));
    expect(steps[sweep]).not.toContain("|| true"); // a failing sweep must fail the job
  });
  it("the e2e script's cleanup() trap calls the same sweep script (after its own scrub), and the accounts file has the fixed path the sweep looks for", () => {
    const src = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-e2e-android.sh"),
      "utf8",
    );
    const body = src.slice(
      src.indexOf("cleanup() {"),
      src.indexOf("trap cleanup EXIT"),
    );
    expect(body).toContain("bash scripts/qa-sim-final-sweep.sh");
    expect(body.indexOf("qa-sim-final-sweep.sh")).toBeGreaterThan(
      body.indexOf("qa-sim-scrub.py"),
    );
    expect(src).toContain('ACC_PATH="${TMPDIR:-/tmp}/qa-sim-accounts.env"');
    expect(src).toContain('ACC_ENV="$ACC_PATH"');
    expect(
      readFileSync(path.join(repoRoot, "scripts/qa-sim-final-sweep.sh"), "utf8"),
    ).toContain('ACC="${TMPDIR:-/tmp}/qa-sim-accounts.env"');
  });
});

describe("v9: both jobs create a fresh venv outside the repo and install the pinned PyYAML into it (hash-checked); the flow guard runs with the venv's python before build_android", () => {
  const wf = readFileSync(
    path.join(repoRoot, "apps/mobile/.eas/workflows/qa-sim-mobile.yml"),
    "utf8",
  );
  const venvSh = readFileSync(path.join(repoRoot, "scripts/qa-sim-venv.sh"), "utf8");
  const code = (t: string) =>
    t
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
  const jobBody = (name: string, next: string) =>
    wf.slice(wf.indexOf(`\n  ${name}:\n`), wf.indexOf(`\n  ${next}:\n`));
  const stepsOf = (body: string) => body.split(/\n {6}- /).slice(1);
  const guardJob = jobBody("guard", "build_android");
  const gsteps = stepsOf(guardJob);
  const e2eJob = wf.slice(wf.indexOf("\n  e2e_android:\n"));
  const esteps = stepsOf(e2eJob);
  const gidx = (needle: string) => gsteps.findIndex((x) => x.includes(needle));
  const eidx = (needle: string) => esteps.findIndex((x) => x.includes(needle));
  const CD = 'top=$(git rev-parse --show-toplevel) && cd "$top" || exit 1';
  const CREATE = "bash scripts/qa-sim-venv.sh create";
  const CLEAN = "bash scripts/qa-sim-venv.sh cleanup";
  const PIP =
    '"$PY" -m pip install --no-deps --only-binary=:all: --require-hashes -r scripts/qa-sim-requirements.txt';
  const ALWAYS = "if: ${{ always() }}";
  const PYCHECK =
    '[ -n "${QA_SIM_PY:-}" ] && [ -x "$QA_SIM_PY" ] || { echo "QA_SIM_PY is unset or not executable';

  it("static: both jobs have a venv-create step (fail-loud cd first); the script makes `python3 -m venv`, installs with <venv>/bin/python -m pip --no-deps --only-binary=:all: --require-hashes -r requirements; no --user, no system pip, no bare python3 anywhere in the workflow", () => {
    for (const [steps, i] of [
      [gsteps, gidx(CREATE)],
      [esteps, eidx(CREATE)],
    ] as const) {
      expect(i).toBeGreaterThan(-1);
      expect(steps[i]).toContain(CD);
      expect(steps[i].indexOf(CD)).toBeLessThan(steps[i].indexOf(CREATE));
      expect(steps[i]).not.toContain("|| true");
    }
    const sh = code(venvSh);
    expect(sh).toContain(PIP);
    expect(sh).toContain('PY="$d/venv/bin/python"');
    expect(sh).toContain('mktemp -d "$bphys/qa-sim-venv.XXXXXX"');
    expect(sh).toContain('base="${TMPDIR:-/tmp}"');
    // the only `python3` in the script is the venv creation; every pip install is the venv's, with both flags
    const py3 = sh.split("\n").filter((l) => l.includes("python3"));
    expect(py3.length).toBe(1);
    expect(py3[0].trimStart().startsWith('python3 -m venv "$d/venv"')).toBe(true);
    expect(sh.indexOf('python3 -m venv "$d/venv"')).toBeLessThan(sh.indexOf(PIP));
    for (const l of sh.match(/[^\n]*\bpip3? install\b[^\n]*/g) ?? []) {
      expect(l).toContain(PIP);
    }
    expect(sh).not.toContain("--user");
    expect(sh).not.toContain("|| true");
    const y = code(wf);
    expect(y).not.toContain("--user");
    expect(y).not.toMatch(/\bpython3\b/);
    expect(y).not.toMatch(/\bpython\s+scripts\//);
    expect(y).not.toMatch(/pip3? install/);
  });

  it("static: guard job order checkout < repo guard < venv create < flow guard (with the venv's python, loud if QA_SIM_PY is unset) < cleanup(always); build_android needs the guard job and has no venv or flow guard", () => {
    const co = gidx("eas/checkout");
    const pin = gidx("qa-sim-guard.sh");
    const cr = gidx(CREATE);
    const fg = gidx("qa-sim-flow-guard.py");
    const cl = gidx(CLEAN);
    expect(co).toBe(0);
    expect(pin).toBeGreaterThan(co);
    expect(cr).toBeGreaterThan(pin);
    expect(fg).toBeGreaterThan(cr);
    expect(cl).toBeGreaterThan(fg);
    expect(cl).toBe(gsteps.length - 1);
    expect(gsteps[fg]).toContain(CD);
    expect(gsteps[fg]).toContain(PYCHECK);
    expect(gsteps[fg].indexOf(PYCHECK)).toBeLessThan(
      gsteps[fg].indexOf("qa-sim-flow-guard.py"),
    );
    expect(gsteps[fg]).toContain('"$QA_SIM_PY" scripts/qa-sim-flow-guard.py');
    expect(gsteps[fg]).not.toContain("|| true");
    expect(gsteps[cl]).toContain(ALWAYS);
    const build = jobBody("build_android", "e2e_android");
    // `needs: [guard]` as a REAL key of the build job (4-space indent, not a comment, not in a string)
    expect(code(build)).toMatch(/\n {4}needs: \[guard\]\n/);
    expect(code(build).match(/needs:/g)?.length).toBe(1);
    // both custom jobs run on the same image (sdk-54), so a Python/venv surprise on that image shows in the guard job, before the build
    expect(code(guardJob)).toMatch(/\n {4}image: sdk-54\b/);
    expect(code(e2eJob)).toMatch(/\n {4}image: sdk-54\b/);
    expect(code(guardJob)).toMatch(/\n {4}runs_on: linux-medium\n/);
    for (const n of [
      "qa-sim-requirements.txt",
      "qa-sim-flow-guard.py",
      "qa-sim-venv.sh",
    ])
      expect(build).not.toContain(n);
    const bpos = wf.indexOf("\n  build_android:\n");
    expect(wf.indexOf(CREATE)).toBeLessThan(bpos);
    expect(wf.indexOf("qa-sim-flow-guard.py")).toBeLessThan(bpos);
  });

  it("static: the e2e job creates its own venv before the build is downloaded and before the e2e script, checks QA_SIM_PY before the e2e script, and deletes the venv folder in a last always() step; qa-sim-maestro.sh uses QA_SIM_PY", () => {
    const cr = eidx(CREATE);
    const dl = eidx("eas/download_build");
    const run = eidx("qa-sim-e2e-android.sh");
    const up = eidx("eas/upload_artifact");
    const cl = eidx(CLEAN);
    expect(cr).toBeGreaterThan(eidx("eas/checkout"));
    expect(cr).toBeLessThan(dl);
    expect(dl).toBeLessThan(run);
    expect(esteps[run]).toContain(PYCHECK);
    expect(esteps[run].indexOf(PYCHECK)).toBeLessThan(
      esteps[run].indexOf("qa-sim-e2e-android.sh"),
    );
    expect(cl).toBe(esteps.length - 1);
    expect(cl).toBeGreaterThan(up);
    expect(esteps[cl]).toContain(ALWAYS);
    const m = code(
      readFileSync(path.join(repoRoot, "scripts/qa-sim-maestro.sh"), "utf8"),
    );
    expect(m).toContain('"$PYBIN" scripts/qa-sim-flow-guard.py');
    expect(m).not.toMatch(/python3 scripts\/qa-sim-flow-guard\.py/);
    expect(m).toContain('PYBIN="${QA_SIM_PY:-}"');
    const e = code(
      readFileSync(path.join(repoRoot, "scripts/qa-sim-e2e-android.sh"), "utf8"),
    );
    expect(e.indexOf('[ ! -x "${QA_SIM_PY:-}" ]')).toBeGreaterThan(-1);
    expect(e.indexOf('[ ! -x "${QA_SIM_PY:-}" ]')).toBeLessThan(
      e.indexOf("bash scripts/qa-sim-maestro.sh"),
    );
  });

  it("static: the venv python runs EVERYTHING that needs PyYAML: no bare python3 (or python, or direct execution) of the flow guard or of any yaml-importing script, and no inline yaml import, anywhere in the workflow or scripts/*.sh; the stdlib-only scripts (api, tap, purge, scrub, sweep) may stay on python3", () => {
    const names = readdirSync(path.join(repoRoot, "scripts"));
    const importsYaml = (t: string) =>
      /^\s*(try:\s*)?(import yaml|from yaml)\b/m.test(t) ||
      /\bimport yaml\b|\bfrom yaml import\b/.test(t);
    const yamlPy = names.filter(
      (n) =>
        n.endsWith(".py") &&
        importsYaml(readFileSync(path.join(repoRoot, "scripts", n), "utf8")),
    );
    expect(yamlPy).toEqual(["qa-sim-flow-guard.py"]);
    const files = [
      "apps/mobile/.eas/workflows/qa-sim-mobile.yml",
      ...names.filter((n) => n.endsWith(".sh")).map((n) => `scripts/${n}`),
    ];
    let venvInvocations = 0;
    for (const f of files) {
      const t = code(readFileSync(path.join(repoRoot, f), "utf8"));
      // inline PyYAML use (a heredoc or `python3 -c`) in the run path would run on the system python: none allowed except the venv's own import check
      if (f !== "scripts/qa-sim-venv.sh")
        expect(t, f).not.toMatch(/\bimport yaml\b|\bfrom yaml\b/);
      for (const line of t.split("\n")) {
        for (const n of yamlPy) {
          if (!line.includes(n)) continue;
          // not run by an interpreter name, not run directly (its shebang is `env python3`), not via bash/sh
          expect(line, `${f}: ${line}`).not.toMatch(
            new RegExp(
              `(^|[\\s;&|(!])(/usr/bin/env\\s+)?(python3?(\\.\\d+)?|bash|sh|\\./)\\s*(\\S+/)?${n.replace(/\./g, "\\.")}`,
            ),
          );
          expect(line, `${f}: ${line}`).not.toMatch(
            new RegExp(`^\\s*(\\./)?(\\S+/)?${n.replace(/\./g, "\\.")}`),
          );
          if (/"\$(QA_SIM_PY|PYBIN)"\s+(\S+\/)?qa-sim-flow-guard\.py/.test(line))
            venvInvocations++;
        }
      }
    }
    // the two run-path invocations (the workflow guard step and qa-sim-maestro.sh) are the venv's; the maestro script's own copy goes through PYBIN <- QA_SIM_PY
    expect(venvInvocations).toBeGreaterThanOrEqual(2);
    // the only `python3` in the workflow is none; in scripts/*.sh the venv script's `python3 -m venv` is the only one that is not a stdlib-only script
    expect(code(wf)).not.toMatch(/\bpython3\b|\bpython\s+\S*\.py/);
    // every other `python3 <script>` (literal, or through a variable assigned a scripts/*.py path) runs a stdlib-only script, and there is at least one such call
    let stdlibCalls = 0;
    for (const f of files.filter((x) => x.endsWith(".sh"))) {
      const t = code(readFileSync(path.join(repoRoot, f), "utf8"));
      const vars: Record<string, string> = {};
      for (const m of t.matchAll(/\b([A-Z][A-Z_]*)="(?:\$\{[A-Z_]+:-)?([^"}]*\.py)/g))
        vars[m[1]] = m[2];
      for (const line of t.split("\n")) {
        for (const m of line.matchAll(/\bpython3?\s+"?([^\s"]+\.py|\$[A-Z_]+)"?/g)) {
          const target = /^\$[A-Z_]+$/.test(m[1]) ? vars[m[1].slice(1)] : m[1];
          expect(target, `${f}: ${line}`).toBeTruthy();
          expect(yamlPy, `${f}: ${line}`).not.toContain(path.basename(target));
          stdlibCalls++;
        }
      }
    }
    expect(stdlibCalls).toBeGreaterThan(5);
  });

  it("scripts/qa-sim-requirements.txt: ONE package, pinned with ==, sha256 hashes for the sdist and the 4 cp310-313 manylinux x86_64 wheels, nothing else (no index, no URL, no editable)", () => {
    const txt = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-requirements.txt"),
      "utf8",
    );
    const code = txt
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    const joined = code.replace(/\\\n/g, " ").trim();
    expect(joined.split("\n").length).toBe(1);
    const one = joined.replace(/\s+/g, " ");
    expect(one).toMatch(
      /^PyYAML==\d+\.\d+(\.\d+)? --hash=sha256:[0-9a-f]{64}( --hash=sha256:[0-9a-f]{64}){4}$/,
    );
    expect(joined).not.toMatch(
      /--index-url|--extra-index-url|--find-links|-e |https?:|git\+/,
    );
    const hashes = joined.match(/[0-9a-f]{64}/g) ?? [];
    expect(new Set(hashes).size).toBe(5);
    // the header documents which artifact each hash is (prefix of the hash + file name)
    for (const h of hashes) expect(txt).toContain(`#   ${h.slice(0, 16)}...`);
    for (const n of [
      "tar.gz",
      "cp310-cp310",
      "cp311-cp311",
      "cp312-cp312",
      "cp313-cp313",
    ])
      expect(txt).toContain(n);
    expect(txt.match(/manylinux2014_x86_64/g)?.length).toBe(4);
  });

  it("the installed PyYAML is a pin: every pip install in the workflow and the scripts is the hash-checked, no-deps install of the requirements file, and only the flow guard imports yaml", () => {
    const names = readdirSync(path.join(repoRoot, "scripts"));
    for (const f of [
      "apps/mobile/.eas/workflows/qa-sim-mobile.yml",
      ...names.filter((n) => n.endsWith(".sh")).map((n) => `scripts/${n}`),
    ]) {
      const t = readFileSync(path.join(repoRoot, f), "utf8");
      for (const l of t.match(/\bpip3? install\b[^\n]*/g) ?? [])
        expect(l, f).toContain(
          "--no-deps --only-binary=:all: --require-hashes -r scripts/qa-sim-requirements.txt",
        );
    }
    for (const n of names.filter((x) => x.endsWith(".py"))) {
      const t = readFileSync(path.join(repoRoot, "scripts", n), "utf8");
      const imports = /^\s*(try:\s*)?(import yaml|from yaml)\b/m.test(t);
      expect(imports, n).toBe(n === "qa-sim-flow-guard.py");
    }
  });
});

describe("v9: scripts/qa-sim-venv.sh runs for real (hermetic repo and TMPDIR; stub set-env; PIP_NO_INDEX with a local wheel)", () => {
  const MARK = ".qa-sim-venv-created";
  const MARK_TEXT = "created by scripts/qa-sim-venv.sh create";
  const made: string[] = [];
  const mk = (prefix: string) => {
    const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
    made.push(d);
    return d;
  };
  afterAll(() => {
    for (const d of made) rmSync(d, { recursive: true, force: true });
  });

  function fx(requirements?: string) {
    const root = mk("qa-venv-repo-");
    const tmp = mk("qa-venv-tmp-");
    const bin = mk("qa-venv-bin-");
    const git = (a: string[]) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
    git(["init", "-q", "-b", "main", "."]);
    mkdirSync(path.join(root, "scripts"));
    cpSync(
      path.join(repoRoot, "scripts/qa-sim-venv.sh"),
      path.join(root, "scripts/qa-sim-venv.sh"),
    );
    writeFileSync(
      path.join(root, "scripts/qa-sim-requirements.txt"),
      requirements ??
        readFileSync(path.join(repoRoot, "scripts/qa-sim-requirements.txt"), "utf8"),
    );
    const setenvLog = path.join(bin, "set-env.log");
    writeFileSync(
      path.join(bin, "set-env"),
      '#!/usr/bin/env bash\nprintf "%s=%s\\n" "$1" "$2" >>"$SETENV_LOG"\n',
    );
    chmodSync(path.join(bin, "set-env"), 0o755);
    const env = (extra: Record<string, string> = {}) => {
      const e: Record<string, string | undefined> = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: tmp,
        SETENV_LOG: setenvLog,
        ...extra,
      };
      for (const k of ["QA_SIM_PY", "QA_SIM_VENV_DIR"]) if (!(k in extra)) delete e[k];
      return e as unknown as NodeJS.ProcessEnv;
    };
    const bash = (cmd: string, extra: Record<string, string> = {}) =>
      spawnSync("bash", ["-c", cmd], {
        cwd: root,
        encoding: "utf8",
        env: env(extra),
      });
    const setenvs = () =>
      existsSync(setenvLog)
        ? Object.fromEntries(
            readFileSync(setenvLog, "utf8")
              .split("\n")
              .filter(Boolean)
              .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
          )
        : {};
    return { root, tmp, bin, bash, setenvs };
  }

  // the `run:` block of a workflow step, dedented
  const runOf = (step: string) =>
    (step.match(/run: \|\n((?: {10}.*\n?)+)/)?.[1] ?? "")
      .split("\n")
      .map((l) => l.slice(10))
      .join("\n");
  const wf = readFileSync(
    path.join(repoRoot, "apps/mobile/.eas/workflows/qa-sim-mobile.yml"),
    "utf8",
  );
  const guardSteps = wf
    .slice(wf.indexOf("\n  guard:\n"), wf.indexOf("\n  build_android:\n"))
    .split(/\n {6}- /)
    .slice(1);
  const createRun = runOf(guardSteps.find((x) => x.includes("venv.sh create"))!);
  const flowRun = runOf(guardSteps.find((x) => x.includes("qa-sim-flow-guard.py"))!);
  const cleanRun = runOf(guardSteps.find((x) => x.includes("venv.sh cleanup"))!);

  it("venv creation FAILS (python3 -m venv exits 1): the guard job fails closed: create step fails, the flow guard never runs with any python, set-env is never called, no folder is left, the build is skipped", () => {
    const f = fx();
    const fake = path.join(f.bin, "python3");
    const calls = path.join(f.bin, "py3.log");
    writeFileSync(
      fake,
      `#!/usr/bin/env bash\necho "$*" >>"${calls}"\nif [ "$1" = -m ] && [ "$2" = venv ]; then echo "ensurepip is not available" >&2; exit 1; fi\nexec "${SYS_PY}" "$@"\n`,
    );
    chmodSync(fake, 0o755);
    // what EAS does with a job: run the steps in order; after a failure only `if: always()` steps run; a failed guard job means build_android (needs: [guard]) never starts
    let failed = false;
    const ran: string[] = [];
    for (const [name, body, always] of [
      ["create", createRun, false],
      ["flow-guard", flowRun, false],
      ["cleanup", cleanRun, true],
    ] as const) {
      if (failed && !always) continue;
      const r = f.bash(body, f.setenvs());
      ran.push(`${name}:${r.status}`);
      if (name === "create") expect(r.stderr).toContain("python3 -m venv failed");
      if (r.status !== 0) failed = true;
    }
    expect(ran).toEqual(["create:1", "cleanup:0"]);
    const buildRuns = !failed;
    expect(buildRuns).toBe(false);
    expect(f.setenvs()).toEqual({});
    expect(readdirSync(f.tmp)).toEqual([]); // the folder this run made was removed
    expect(readFileSync(calls, "utf8").trim().split("\n")).toEqual([
      expect.stringMatching(/^-m venv .*\/qa-sim-venv\.[A-Za-z0-9]+\/venv$/),
    ]);
    // even if the step order were wrong and the flow-guard step ran anyway: unset or non-executable QA_SIM_PY fails it, and python3 is not tried
    for (const extra of [{}, { QA_SIM_PY: path.join(f.tmp, "nope/python") }]) {
      const r = f.bash(flowRun, extra as Record<string, string>);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("QA_SIM_PY is unset or not executable");
    }
    expect(readFileSync(calls, "utf8")).not.toContain("flow-guard");
  });

  // a minimal PyYAML 6.0.3 wheel (pure python) so the real venv + real pip run offline
  function wheelDir(tag = "py3-none-any") {
    const dir = mk("qa-venv-wheel-");
    const r = spawnSync(
      SYS_PY,
      [
        "-c",
        [
          "import base64, hashlib, sys, zipfile",
          "d = sys.argv[1]",
          "di = 'PyYAML-6.0.3.dist-info'",
          "files = {'yaml/__init__.py': '__version__ = \"6.0.3\"\\n', di + '/METADATA': 'Metadata-Version: 2.1\\nName: PyYAML\\nVersion: 6.0.3\\n', di + '/WHEEL': 'Wheel-Version: 1.0\\nGenerator: test\\nRoot-Is-Purelib: true\\nTag: ' + sys.argv[2] + '\\n'}",
          "rec = []",
          "for n, t in files.items():",
          "    h = base64.urlsafe_b64encode(hashlib.sha256(t.encode()).digest()).rstrip(b'=').decode()",
          "    rec.append('%s,sha256=%s,%d' % (n, h, len(t.encode())))",
          "rec.append(di + '/RECORD,,')",
          "files[di + '/RECORD'] = '\\n'.join(rec) + '\\n'",
          "with zipfile.ZipFile(d + '/PyYAML-6.0.3-' + sys.argv[2].replace('.', '_') + '.whl', 'w') as z:",
          "    for n, t in files.items(): z.writestr(n, t)",
        ].join("\n"),
        dir,
        tag,
      ],
      { encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(0);
    const sha = createHash("sha256")
      .update(readFileSync(path.join(dir, `PyYAML-6.0.3-${tag}.whl`)))
      .digest("hex");
    return { dir, sha };
  }
  const OFFLINE = (dir: string) => ({
    PIP_NO_INDEX: "1",
    PIP_FIND_LINKS: dir,
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
    PIP_CONFIG_FILE: "/dev/null",
  });

  it("a real venv + real pip: a requirements file with ZEROED hashes is rejected (hash mismatch), the step fails, nothing is exported and the folder is removed; with the right hash the same install passes, QA_SIM_PY imports yaml, and cleanup deletes only that folder", () => {
    const { dir, sha } = wheelDir();
    const real = readFileSync(
      path.join(repoRoot, "scripts/qa-sim-requirements.txt"),
      "utf8",
    );
    const zeroed = real.replace(
      /--hash=sha256:[0-9a-f]{64}/g,
      `--hash=sha256:${"0".repeat(64)}`,
    );
    expect(zeroed).not.toBe(real);
    const bad = fx(zeroed);
    const r = bad.bash("bash scripts/qa-sim-venv.sh create", OFFLINE(dir));
    const out = r.stdout + r.stderr;
    expect(r.status, out).toBe(1);
    expect(out).toMatch(/DO NOT MATCH THE HASHES/i);
    expect(out).toContain("hash-checked, wheel-only PyYAML install failed");
    expect(bad.setenvs()).toEqual({});
    expect(readdirSync(bad.tmp)).toEqual([]);

    const good = fx(`PyYAML==6.0.3 --hash=sha256:${sha}\n`);
    const keep = path.join(good.tmp, "unrelated");
    mkdirSync(keep);
    const ok = good.bash("bash scripts/qa-sim-venv.sh create", OFFLINE(dir));
    expect(ok.status, ok.stdout + ok.stderr).toBe(0);
    const ex = good.setenvs() as Record<string, string>;
    expect(Object.keys(ex).sort()).toEqual(["QA_SIM_PY", "QA_SIM_VENV_DIR"]);
    expect(path.dirname(ex.QA_SIM_VENV_DIR)).toBe(good.tmp);
    expect(path.basename(ex.QA_SIM_VENV_DIR)).toMatch(/^qa-sim-venv\.[A-Za-z0-9]+$/);
    expect(ex.QA_SIM_PY).toBe(path.join(ex.QA_SIM_VENV_DIR, "venv/bin/python"));
    expect(ex.QA_SIM_VENV_DIR.startsWith(good.root)).toBe(false);
    expect(readFileSync(path.join(ex.QA_SIM_VENV_DIR, MARK), "utf8")).toBe(
      `${MARK_TEXT}\n`,
    );
    const imp = spawnSync(
      ex.QA_SIM_PY,
      ["-c", "import yaml,sys; print(yaml.__version__, sys.prefix)"],
      { encoding: "utf8" },
    );
    expect(imp.status, imp.stderr).toBe(0);
    expect(imp.stdout).toContain("6.0.3");
    expect(imp.stdout).toContain(path.join(ex.QA_SIM_VENV_DIR, "venv"));
    const cl = good.bash("bash scripts/qa-sim-venv.sh cleanup", ex);
    expect(cl.status, cl.stderr).toBe(0);
    expect(existsSync(ex.QA_SIM_VENV_DIR)).toBe(false);
    expect(existsSync(keep)).toBe(true); // a neighbour in TMPDIR is untouched
  }, 120_000);

  it("--only-binary=:all:: with only an sdist and a wheel for another interpreter (cp36, never compatible) the install FAILS CLOSED: the sdist is never built (its build backend never runs), nothing is exported, the folder is removed; the control (flag removed from a copy of the script) DOES build the sdist, so the test can tell", () => {
    // wrong-tag wheel + an sdist whose in-tree PEP 517 backend writes a marker file when (and only when) pip builds it
    const dir = mk("qa-venv-sdist-");
    const wrong = wheelDir("cp36-cp36m-manylinux2014_x86_64");
    const wheelFile = path.join(
      wrong.dir,
      "PyYAML-6.0.3-cp36-cp36m-manylinux2014_x86_64.whl",
    );
    cpSync(wheelFile, path.join(dir, path.basename(wheelFile)));
    const src = mk("qa-venv-sdistsrc-");
    const marker = path.join(src, "SDIST-WAS-BUILT");
    const pkg = path.join(src, "PyYAML-6.0.3");
    mkdirSync(pkg);
    writeFileSync(
      path.join(pkg, "pyproject.toml"),
      '[build-system]\nrequires = []\nbuild-backend = "backend"\nbackend-path = ["."]\n',
    );
    writeFileSync(
      path.join(pkg, "PKG-INFO"),
      "Metadata-Version: 2.1\nName: PyYAML\nVersion: 6.0.3\n",
    );
    writeFileSync(
      path.join(pkg, "backend.py"),
      [
        "import os, zipfile",
        "def get_requires_for_build_wheel(config_settings=None): return []",
        "def build_wheel(wheel_directory, config_settings=None, metadata_directory=None):",
        `    open(${JSON.stringify(marker)}, 'w').write('built')`,
        "    n = 'PyYAML-6.0.3-py3-none-any.whl'",
        "    di = 'PyYAML-6.0.3.dist-info'",
        "    with zipfile.ZipFile(os.path.join(wheel_directory, n), 'w') as z:",
        "        z.writestr('yaml/__init__.py', '__version__ = \"6.0.3\"\\n')",
        "        z.writestr(di + '/METADATA', 'Metadata-Version: 2.1\\nName: PyYAML\\nVersion: 6.0.3\\n')",
        "        z.writestr(di + '/WHEEL', 'Wheel-Version: 1.0\\nGenerator: t\\nRoot-Is-Purelib: true\\nTag: py3-none-any\\n')",
        "        z.writestr(di + '/RECORD', '')",
        "    return n",
        "",
      ].join("\n"),
    );
    const tgz = path.join(dir, "PyYAML-6.0.3.tar.gz");
    const tar = spawnSync("tar", ["-czf", tgz, "-C", src, "PyYAML-6.0.3"], {
      encoding: "utf8",
    });
    expect(tar.status, tar.stderr).toBe(0);
    const h = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");
    const reqs = `PyYAML==6.0.3 --hash=sha256:${h(tgz)} --hash=sha256:${h(wheelFile)}\n`;
    const f = fx(reqs);
    const r = f.bash("bash scripts/qa-sim-venv.sh create", OFFLINE(dir));
    const out = r.stdout + r.stderr;
    expect(r.status, out).toBe(1);
    expect(out).toContain("hash-checked, wheel-only PyYAML install failed");
    expect(existsSync(marker), "the sdist must never be built").toBe(false);
    expect(f.setenvs()).toEqual({});
    expect(readdirSync(f.tmp)).toEqual([]);
    // control: the same files, the same script with --only-binary=:all: removed from the install line: the sdist IS built (the marker appears)
    const c = fx(reqs);
    const sh = path.join(c.root, "scripts/qa-sim-venv.sh");
    const txt = readFileSync(sh, "utf8");
    expect(txt).toContain("--only-binary=:all: ");
    writeFileSync(sh, txt.replaceAll("--only-binary=:all: ", ""));
    const cr = c.bash("bash scripts/qa-sim-venv.sh create", OFFLINE(dir));
    expect(existsSync(marker), cr.stdout + cr.stderr).toBe(true);
  }, 120_000);

  it("location rule: TMPDIR inside the repo, inside qa-sim-artifacts/, or a symlink into the repo: create fails before any folder or venv exists; python3 is never run", () => {
    const f = fx();
    const fake = path.join(f.bin, "python3");
    const calls = path.join(f.bin, "py3.log");
    writeFileSync(fake, `#!/usr/bin/env bash\necho "$*" >>"${calls}"\nexit 0\n`);
    chmodSync(fake, 0o755);
    mkdirSync(path.join(f.root, "sub"));
    mkdirSync(path.join(f.root, "qa-sim-artifacts/t"), { recursive: true });
    symlinkSync(path.join(f.root, "sub"), path.join(f.tmp, "link"));
    for (const t of [
      f.root,
      path.join(f.root, "sub"),
      path.join(f.root, "qa-sim-artifacts/t"),
      path.join(f.tmp, "link"),
    ]) {
      const r = f.bash("bash scripts/qa-sim-venv.sh create", { TMPDIR: t });
      expect(r.status, t).toBe(1);
      expect(r.stderr, t).toContain("inside the repo");
    }
    expect(
      readdirSync(f.root)
        .filter((n) => n !== ".git")
        .sort(),
    ).toEqual(["qa-sim-artifacts", "scripts", "sub"]);
    expect(readdirSync(path.join(f.root, "sub"))).toEqual([]);
    expect(existsSync(calls)).toBe(false);
    expect(f.setenvs()).toEqual({});
    // a TMPDIR that does not exist also fails
    expect(
      f.bash("bash scripts/qa-sim-venv.sh create", {
        TMPDIR: path.join(f.tmp, "missing"),
      }).status,
    ).toBe(1);
  });

  it("cleanup deletes only a folder this script created: unset = nothing; refuses a missing marker, a symlink, a wrong name, a folder inside the repo; deletes a genuine one and leaves its neighbours", () => {
    const f = fx();
    const un = f.bash("bash scripts/qa-sim-venv.sh cleanup");
    expect(un.status).toBe(0);
    expect(un.stdout).toContain("nothing to delete");
    const mkdir = (p: string, marker = true) => {
      mkdirSync(p, { recursive: true });
      if (marker) writeFileSync(path.join(p, MARK), `${MARK_TEXT}\n`);
      writeFileSync(path.join(p, "keep.txt"), "x");
      return p;
    };
    const noMarker = mkdir(path.join(f.tmp, "qa-sim-venv.nomark"), false);
    const wrongName = mkdir(path.join(f.tmp, "other-folder"));
    const inRepo = mkdir(path.join(f.root, "qa-sim-venv.inrepo"));
    const target = mkdir(path.join(f.tmp, "target-dir"));
    const link = path.join(f.tmp, "qa-sim-venv.link");
    symlinkSync(target, link);
    const badMark = mkdir(path.join(f.tmp, "qa-sim-venv.badmark"));
    writeFileSync(path.join(badMark, MARK), "something else\n");
    for (const d of [
      noMarker,
      wrongName,
      inRepo,
      link,
      badMark,
      path.join(f.tmp, "qa-sim-venv.missing"),
    ]) {
      const r = f.bash("bash scripts/qa-sim-venv.sh cleanup", { QA_SIM_VENV_DIR: d });
      expect(r.status, d).toBe(1);
      expect(r.stderr, d).toContain("refusing to delete");
    }
    for (const d of [noMarker, wrongName, inRepo, target, badMark])
      expect(existsSync(path.join(d, "keep.txt")), d).toBe(true);
    const mine = mkdir(path.join(f.tmp, "qa-sim-venv.mine"));
    const r = f.bash("bash scripts/qa-sim-venv.sh cleanup", { QA_SIM_VENV_DIR: mine });
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(mine)).toBe(false);
    expect(existsSync(path.join(noMarker, "keep.txt"))).toBe(true);
  });
});

describe("v9 advisory A1: scripts/qa-sim-api.py provision() opens the accounts file with O_NOFOLLOW (+ O_CREAT|O_EXCL) and refuses a symlink, a non-regular file, a file that is not ours and a hard link", () => {
  const made: string[] = [];
  afterAll(() => {
    for (const d of made) rmSync(d, { recursive: true, force: true });
  });
  const api = path.join(repoRoot, "scripts/qa-sim-api.py");
  // load the real module, stub only register() (no server), call provision(path), print the return code
  const run = (target: string) =>
    spawnSync(
      SYS_PY,
      [
        "-c",
        [
          "import importlib.util, sys",
          "s = importlib.util.spec_from_file_location('api', sys.argv[1])",
          "m = importlib.util.module_from_spec(s); s.loader.exec_module(m)",
          "m.register = lambda *a, **k: True",
          "print('RC=%d' % m.provision(sys.argv[2]))",
        ].join("\n"),
        api,
        target,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: "1",
        } as unknown as NodeJS.ProcessEnv,
      },
    );
  const dirOf = () => {
    const d = realpathSync(mkdtempSync(path.join(tmpdir(), "qa-a1-")));
    made.push(d);
    return d;
  };
  const rc = (r: { stdout: string }) => /RC=(\d+)/.exec(r.stdout)?.[1];

  it("static: O_NOFOLLOW and O_EXCL are in the open flags, O_TRUNC is not (a truncating open of a planted file would run before any check)", () => {
    const t = readFileSync(api, "utf8");
    const fn = t.slice(t.indexOf("def open_envfile"), t.indexOf("def provision"));
    expect(fn).toMatch(/nofollow\s*=\s*getattr\(os,\s*"O_NOFOLLOW"/);
    expect(fn).toMatch(
      /os\.O_WRONLY\s*\|\s*os\.O_CREAT\s*\|\s*os\.O_EXCL\s*\|\s*nofollow/,
    );
    expect(fn).toMatch(/os\.O_WRONLY\s*\|\s*nofollow\s*\|\s*os\.O_NONBLOCK/);
    expect(fn).toMatch(/st_uid\s*!=\s*os\.geteuid\(\)/);
    expect(fn).toMatch(/st_nlink\s*!=\s*1/);
    expect(t).not.toMatch(/O_TRUNC/);
    expect(t).not.toMatch(/(^|[^.\w])open\(\s*envfile/m);
  });

  it("a symlink (to a file, dangling, to a directory) is refused: rc 1, the target is untouched / not created, a message on stderr, no secret printed", () => {
    const d = dirOf();
    const victim = path.join(d, "victim.txt");
    writeFileSync(victim, "KEEP\n");
    const l1 = path.join(d, "l1");
    symlinkSync(victim, l1);
    const r1 = run(l1);
    expect(rc(r1), r1.stdout + r1.stderr).toBe("1");
    expect(r1.stderr).toContain("refusing to write the accounts file");
    expect(readFileSync(victim, "utf8")).toBe("KEEP\n");
    expect(lstatSync(l1).isSymbolicLink()).toBe(true);
    const ghost = path.join(d, "ghost.txt");
    const l2 = path.join(d, "l2");
    symlinkSync(ghost, l2);
    const r2 = run(l2);
    expect(rc(r2), r2.stdout + r2.stderr).toBe("1");
    expect(existsSync(ghost)).toBe(false);
    const sub = path.join(d, "sub");
    mkdirSync(sub);
    const l3 = path.join(d, "l3");
    symlinkSync(sub, l3);
    expect(rc(run(l3))).toBe("1");
    expect(readdirSync(sub)).toEqual([]);
    for (const r of [r1, r2]) expect(r.stdout + r.stderr).not.toMatch(/_PASSWORD=|Aa1/);
  });

  it("a directory, a hard-linked file (nlink 2) and a missing parent are refused; a FIFO is refused without hanging", () => {
    const d = dirOf();
    const dd = path.join(d, "adir");
    mkdirSync(dd);
    expect(rc(run(dd))).toBe("1");
    const orig = path.join(d, "orig.env");
    writeFileSync(orig, "KEEP\n", { mode: 0o600 });
    const hl = path.join(d, "hard.env");
    linkSync(orig, hl);
    expect(rc(run(hl))).toBe("1");
    expect(readFileSync(orig, "utf8")).toBe("KEEP\n");
    expect(rc(run(path.join(d, "nodir/acc.env")))).toBe("1");
    const fifo = path.join(d, "fifo.env");
    expect(spawnSync("mkfifo", [fifo]).status).toBe(0);
    const t0 = Date.now();
    const rr = run(fifo);
    expect(Date.now() - t0).toBeLessThan(20_000);
    expect(rc(rr), rr.stdout + rr.stderr).toBe("1");
  });

  it("a new file is created 0600; an existing regular file of ours is rewritten (not appended to) and set to 0600; the file holds the 12 account lines", () => {
    const d = dirOf();
    const f = path.join(d, "new.env");
    const r = run(f);
    expect(rc(r), r.stdout + r.stderr).toBe("0");
    expect(statSync(f).mode & 0o777).toBe(0o600);
    const lines = readFileSync(f, "utf8").trim().split("\n");
    expect(lines).toHaveLength(12);
    expect(lines.map((l) => l.split("=")[0])).toEqual([
      "M10_EMAIL",
      "M10_PASSWORD",
      "M11_EMAIL",
      "M11_PASSWORD",
      "M50_EMAIL",
      "M50_PASSWORD",
      "A_EMAIL",
      "A_PASSWORD",
      "B_EMAIL",
      "B_PASSWORD",
      "S_EMAIL",
      "S_PASSWORD",
    ]);
    const ex = path.join(d, "existing.env");
    writeFileSync(ex, "OLD=".padEnd(5000, "x") + "\n", { mode: 0o644 });
    chmodSync(ex, 0o644);
    const r2 = run(ex);
    expect(rc(r2), r2.stdout + r2.stderr).toBe("0");
    expect(statSync(ex).mode & 0o777).toBe(0o600);
    const t = readFileSync(ex, "utf8");
    expect(t).not.toContain("OLD=");
    expect(t.trim().split("\n")).toHaveLength(12);
    expect(r2.stdout + r2.stderr).not.toMatch(/_PASSWORD=/);
  });
});

describe("qa-sim-mobile.yml artifact upload", () => {
  const wf = readFileSync(
    path.join(repoRoot, "apps/mobile/.eas/workflows/qa-sim-mobile.yml"),
    "utf8",
  );
  it("lists both qa-sim-artifacts/**/* and ../../qa-sim-artifacts/**/* in the one upload step", () => {
    expect(wf).toMatch(
      /path: \|\n\s+qa-sim-artifacts\/\*\*\/\*\n\s+\.\.\/\.\.\/qa-sim-artifacts\/\*\*\/\*\n/,
    );
    expect(wf.match(/uses: eas\/upload_artifact/g)?.length).toBe(1);
  });
  it("the check step before it does not count dotfiles (the upload glob skips them)", () => {
    expect(wf).toContain("find qa-sim-artifacts -type f ! -path '*/.*' | wc -l");
  });
});

describe("qa-sim-collect.sh is not runnable in this workflow", () => {
  const fnPath = path.join(
    repoRoot,
    "apps/mobile/.eas/functions/qa-sim-run/function.yml",
  );
  const fn = readFileSync(fnPath, "utf8");
  it("is not in the allowlist of the qa-sim-run function and no workflow or function names it", () => {
    const caseLine = fn.split("\n").find((l) => l.includes("qa-sim-guard.sh|"));
    expect(caseLine).toBeDefined();
    expect(caseLine).not.toContain("qa-sim-collect");
    const dir = path.join(repoRoot, "apps/mobile/.eas");
    const files = spawnSync("find", [dir, "-type", "f"], { encoding: "utf8" })
      .stdout.split("\n")
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files)
      expect(readFileSync(f, "utf8"), f).not.toContain("qa-sim-collect");
  });
  it("running the function's own script with QA_SIM_SCRIPT=qa-sim-collect.sh is refused (exit 1) and never starts the script", () => {
    const body = fn.split("      run: |\n")[1];
    const script = body
      .split("\n")
      .map((l) => l.replace(/^ {8}/, ""))
      .join("\n");
    const work = mkdtempSync(path.join(tmpdir(), "qa-collect-"));
    mkdirSync(path.join(work, "scripts"));
    writeFileSync(
      path.join(work, "scripts/qa-sim-collect.sh"),
      "#!/usr/bin/env bash\necho COLLECT-RAN\n",
    );
    const go = (name: string) =>
      spawnSync("bash", ["-c", script], {
        cwd: work,
        encoding: "utf8",
        env: {
          ...process.env,
          QA_SIM_SCRIPT: name,
          QA_SIM_SHA: "",
        } as unknown as NodeJS.ProcessEnv,
      });
    const refused = go("qa-sim-collect.sh");
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("Unexpected QA sim script.");
    expect(refused.stdout).not.toContain("COLLECT-RAN");
    // the same harness still runs an allowlisted script, so the refusal is the allowlist and not a broken harness
    writeFileSync(
      path.join(work, "scripts/qa-sim-web.sh"),
      "#!/usr/bin/env bash\necho WEB-RAN\n",
    );
    expect(go("qa-sim-web.sh").stdout).toContain("WEB-RAN");
  });
});
