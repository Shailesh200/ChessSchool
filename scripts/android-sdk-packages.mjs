#!/usr/bin/env node
/**
 * Print sdkmanager package ids for an Expo / React Native Android build.
 *
 * Generated Expo projects usually point at rootProject.ext.*, and those
 * numbers live in react-native's gradle/libs.versions.toml. Literals in the
 * generated Gradle files win when they are present.
 *
 *   node scripts/android-sdk-packages.mjs apps/mobile/android
 *   node scripts/android-sdk-packages.mjs --self-test
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function versionsFromText(text) {
  const gradle = (name) =>
    text.match(new RegExp(String.raw`\b${name}\s*=\s*["']?([0-9][0-9A-Za-z.\-]*)`, "m"))?.[1] ??
    "";
  const toml = (name) =>
    text.match(new RegExp(String.raw`^[ \t]*${name}\s*=\s*"([^"]+)"`, "m"))?.[1] ?? "";

  const compile =
    gradle("compileSdkVersion") || toml("compileSdk") || gradle("compileSdk");
  const buildTools = gradle("buildToolsVersion") || toml("buildTools");
  const ndk = gradle("ndkVersion") || toml("ndkVersion");
  return { compile, buildTools, ndk };
}

export function packageIds(versions) {
  if (!versions.compile || !versions.buildTools) {
    throw new Error(
      "Could not read compileSdk and buildTools. Expected them in the generated Android project or react-native/gradle/libs.versions.toml.",
    );
  }
  const ids = [
    `platforms;android-${versions.compile}`,
    `build-tools;${versions.buildTools}`,
  ];
  if (versions.ndk) ids.push(`ndk;${versions.ndk}`);
  return ids;
}

function findUp(start, relativePath) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readProject(androidDir) {
  const files = ["build.gradle", "app/build.gradle", "gradle.properties"]
    .map((name) => join(androidDir, name))
    .filter((path) => existsSync(path));
  const gradleText = files.map((path) => readFileSync(path, "utf8")).join("\n");
  const fromGradle = versionsFromText(gradleText);
  if (fromGradle.compile && fromGradle.buildTools) return fromGradle;

  const tomlPath = findUp(androidDir, "node_modules/react-native/gradle/libs.versions.toml");
  if (!tomlPath) return fromGradle;
  const fromToml = versionsFromText(readFileSync(tomlPath, "utf8"));
  return {
    compile: fromGradle.compile || fromToml.compile,
    buildTools: fromGradle.buildTools || fromToml.buildTools,
    ndk: fromGradle.ndk || fromToml.ndk,
  };
}

function selfTest() {
  const versions = versionsFromText(`
    compileSdk rootProject.ext.compileSdkVersion
    [versions]
    compileSdk = "36"
    buildTools = "36.0.0"
    ndkVersion = "27.1.12297006"
  `);
  const ids = packageIds(versions);
  if (ids.join("\n") !== "platforms;android-36\nbuild-tools;36.0.0\nndk;27.1.12297006") {
    throw new Error(`unexpected packages: ${ids.join(", ")}`);
  }
  const literal = versionsFromText(`
    buildToolsVersion = "35.0.0"
    compileSdkVersion = 35
    ndkVersion = "27.1.12297006"
  `);
  if (literal.compile !== "35" || literal.buildTools !== "35.0.0" || literal.ndk !== "27.1.12297006") {
    throw new Error("literal gradle versions were not read");
  }
  console.log("✓ android-sdk-packages self-test");
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectRun()) {
  const arg = process.argv[2];
  if (arg === "--self-test") {
    try {
      selfTest();
    } catch (err) {
      console.error(`✗ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  } else if (!arg) {
    console.error("Usage: android-sdk-packages.mjs <android-project-dir>");
    process.exit(1);
  } else {
    try {
      for (const id of packageIds(readProject(arg))) process.stdout.write(`${id}\n`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
}
