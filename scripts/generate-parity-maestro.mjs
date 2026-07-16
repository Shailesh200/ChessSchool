#!/usr/bin/env node
/**
 * Generates Maestro capture flows from scripts/parity-routes.json.
 * Output: parity/maestro/flows/_cold-boot.yaml, _auth-login.yaml, capture/<id>.yaml
 *
 * Boot flows run once per suite from parity-compare.mjs — per-screen flows are navigation only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(__dirname, "parity-routes.json");
const OUT_FLOWS = path.join(ROOT, "parity", "maestro", "flows");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

function yaml(lines) {
  return `${lines.filter(Boolean).join("\n")}\n`;
}

function stepToYaml(step) {
  if (step.tapTab) {
    return `- tapOn:\n    id: "tab-${step.tapTab}"`;
  }
  if (step.tapTestId) {
    return `- tapOn:\n    id: "${step.tapTestId}"`;
  }
  if (step.tapTestIdOptional) {
    return `- tapOn:\n    id: "${step.tapTestIdOptional}"\n    optional: true`;
  }
  if (step.tapText) {
    return `- tapOn:\n    text: "${step.tapText}"`;
  }
  if (step.scrollUntil) {
    return `- scrollUntilVisible:\n    element:\n      text: "${step.scrollUntil}"\n    direction: DOWN`;
  }
  if (step.scrollUntilTestId) {
    return `- scrollUntilVisible:\n    element:\n      id: "${step.scrollUntilTestId}"\n    direction: DOWN`;
  }
  if (step.openUrl) {
    // Triple-slash so Expo Router treats the path as absolute (not host=first segment).
    const url = step.openUrl.startsWith("http")
      ? step.openUrl
      : `chessschool:///${step.openUrl.replace(/^\//, "")}`;
    return `- openLink: "${url}"`;
  }
  if (step.waitMs) {
    return `- waitForAnimationToEnd:\n    timeout: ${step.waitMs}`;
  }
  return null;
}

function nativeStepsYaml(steps = []) {
  return steps.map(stepToYaml).filter(Boolean).join("\n");
}

fs.mkdirSync(path.join(OUT_FLOWS, "capture"), { recursive: true });

fs.writeFileSync(
  path.join(OUT_FLOWS, "_cold-boot.yaml"),
  yaml([
    "appId: com.chessschool.app",
    "---",
    "- extendedWaitUntil:",
    "    visible:",
    '      id: "orientation-skip"',
    "    optional: true",
    "    timeout: 120000",
    "- tapOn:",
    '    id: "orientation-skip"',
    "    optional: true",
    "- tapOn:",
    '    text: "Open academy →"',
    "    optional: true",
    "- extendedWaitUntil:",
    "    visible:",
    '      id: "tab-Academy"',
    "    timeout: 120000",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Welcome to ChessSchool!"',
    "    timeout: 120000",
    "- tapOn:",
    '    id: "tab-Profile"',
    "    optional: true",
    "- tapOn:",
    '    text: "Log out"',
    "    optional: true",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Daily goal"',
    "    optional: true",
    "    timeout: 30000",
  ]),
);

fs.writeFileSync(
  path.join(OUT_FLOWS, "_auth-login-form.yaml"),
  yaml([
    "appId: com.chessschool.app",
    "---",
    // Deep-link credentials (materialized LOGIN_LINK) — RN controlled inputs ignore Maestro typing.
    "- openLink: ${LOGIN_LINK}",
    "- tapOn:",
    '    text: "Not Now"',
    "    optional: true",
    "- waitForAnimationToEnd:",
    "    timeout: 3000",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Syncing your progress"',
    "    optional: true",
    "    timeout: 20000",
    "- extendedWaitUntil:",
    "    visible:",
    '      id: "tab-Academy"',
    "    optional: true",
    "    timeout: 60000",
    "- openLink: chessschool:///profile",
    "- waitForAnimationToEnd:",
    "    timeout: 2000",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Day streak"',
    "    timeout: 60000",
    "- openLink: chessschool:///academy",
  ]),
);

fs.writeFileSync(
  path.join(OUT_FLOWS, "_auth-login.yaml"),
  yaml([
    "appId: com.chessschool.app",
    "---",
    // Prefer credential deep-link (reliable with controlled RN inputs), then token adopt.
    "- openLink: ${LOGIN_LINK}",
    "- tapOn:",
    '    text: "Not Now"',
    "    optional: true",
    "- waitForAnimationToEnd:",
    "    timeout: 4000",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Syncing your progress"',
    "    optional: true",
    "    timeout: 20000",
    "- extendedWaitUntil:",
    "    visible:",
    '      id: "tab-Academy"',
    "    optional: true",
    "    timeout: 45000",
    // Prove a real session — "Day streak" is above the fold on signed-in Profile only.
    "- openLink: chessschool:///profile",
    "- tapOn:",
    '    text: "Not Now"',
    "    optional: true",
    "- tapOn:",
    '    text: "Open debugger to view warnings."',
    "    optional: true",
    "- waitForAnimationToEnd:",
    "    timeout: 2000",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Day streak"',
    "    optional: true",
    "    timeout: 20000",
    "- runFlow:",
    "    when:",
    "      notVisible:",
    '        text: "Day streak"',
    "    commands:",
    "      - openLink: ${AUTH_LINK}",
    "      - waitForAnimationToEnd:",
    "          timeout: 5000",
    "      - extendedWaitUntil:",
    "          visible:",
    '            id: "tab-Academy"',
    "          optional: true",
    "          timeout: 45000",
    "      - openLink: chessschool:///profile",
    "      - waitForAnimationToEnd:",
    "          timeout: 2000",
    "- extendedWaitUntil:",
    "    visible:",
    '      text: "Day streak"',
    "    timeout: 120000",
    "- openLink: chessschool:///academy",
    "- extendedWaitUntil:",
    "    visible:",
    '      id: "tab-Academy"',
    "    timeout: 60000",
  ]),
);

for (const screen of manifest.screens) {
  const nav = nativeStepsYaml(screen.native?.steps ?? []);
  const ready = screen.native?.readyText ?? screen.web?.readyText;
  const readyId = screen.native?.readyTestId;

  const lines = ["appId: com.chessschool.app", "---"];
  // Re-seed Bearer session before signed-in captures (AUTH_LINK materialized by harness).
  if (screen.auth === "user") {
    lines.push("- openLink: ${AUTH_LINK}");
    lines.push("- waitForAnimationToEnd:");
    lines.push("    timeout: 3000");
    lines.push("- extendedWaitUntil:");
    lines.push("    visible:");
    lines.push('      text: "Syncing your progress"');
    lines.push("    optional: true");
    lines.push("    timeout: 20000");
    lines.push("- extendedWaitUntil:");
    lines.push("    visible:");
    lines.push('      id: "tab-Academy"');
    lines.push("    timeout: 60000");
  }
  if (nav) lines.push(nav);
  if (readyId) {
    lines.push("- extendedWaitUntil:");
    lines.push("    visible:");
    lines.push(`      id: "${readyId}"`);
    lines.push("    timeout: 60000");
  } else if (ready) {
    lines.push("- extendedWaitUntil:");
    lines.push("    visible:");
    lines.push(`      text: "${ready}"`);
    lines.push("    timeout: 60000");
  }
  lines.push("- waitForAnimationToEnd:");
  lines.push("    timeout: 800");

  fs.writeFileSync(path.join(OUT_FLOWS, "capture", `${screen.id}.yaml`), yaml(lines));
}

console.log(`→ Generated ${manifest.screens.length} Maestro capture flows in parity/maestro/flows/capture/`);
