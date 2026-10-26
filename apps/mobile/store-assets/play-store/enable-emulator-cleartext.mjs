#!/usr/bin/env node
/**
 * Allow http://10.0.2.2 on the generated Android project only.
 * Called after `expo prebuild`. Does not edit app.json or any committed source.
 *
 *   node apps/mobile/store-assets/play-store/enable-emulator-cleartext.mjs <AndroidManifest.xml>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("Usage: enable-emulator-cleartext.mjs <AndroidManifest.xml>");
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error(`Generated manifest not found: ${manifestPath}`);
  process.exit(1);
}

let xml = readFileSync(manifestPath, "utf8");
if (!/<application\b/.test(xml)) {
  console.error("Generated manifest has no <application> tag.");
  process.exit(1);
}

xml = xml.replace(/<application\b([^>]*)>/, (_full, attrs) => {
  const next = /android:usesCleartextTraffic=/.test(attrs)
    ? attrs.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="true"')
    : ` android:usesCleartextTraffic="true"${attrs}`;
  return `<application${next}>`;
});
writeFileSync(manifestPath, xml);

const configName = xml.match(/android:networkSecurityConfig="@xml\/([^"]+)"/)?.[1];
if (configName) {
  const configPath = join(dirname(manifestPath), "res", "xml", `${configName}.xml`);
  if (!existsSync(configPath)) {
    console.error(`Network security config referenced but missing: ${configPath}`);
    process.exit(1);
  }
  let config = readFileSync(configPath, "utf8");
  if (/cleartextTrafficPermitted=/.test(config)) {
    config = config.replace(/cleartextTrafficPermitted="[^"]*"/g, 'cleartextTrafficPermitted="true"');
  } else if (/<base-config\b/.test(config)) {
    config = config.replace(/<base-config\b/, '<base-config cleartextTrafficPermitted="true"');
  } else {
    config = config.replace(
      /<network-security-config\b([^>]*)>/,
      '<network-security-config$1>\n    <base-config cleartextTrafficPermitted="true" />',
    );
  }
  writeFileSync(configPath, config);
  console.log(`✓ cleartext allowed in ${configPath}`);
}

console.log("✓ cleartext allowed on the generated capture manifest (emulator → 10.0.2.2)");
