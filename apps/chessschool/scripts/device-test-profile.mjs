// Adds the `device-test` build profile to eas.json on a CI runner (never committed): the production app,
// built for the simulator / as an APK, with EXPO_PUBLIC_DEVICE_TEST=1 (the crash-test link and the puzzle
// test label) and without a crash-report DSN, so test runs never reach the crash dashboard.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../eas.json", import.meta.url);
const eas = JSON.parse(readFileSync(file, "utf8"));
eas.build["device-test"] = {
  extends: "production",
  distribution: "internal",
  channel: "device-test",
  // The DSN lives only in the EAS "production" environment; EAS refuses an empty env value.
  environment: "preview",
  env: { ...eas.build.production.env, EXPO_PUBLIC_DEVICE_TEST: "1" },
  ios: { ...eas.build.production.ios, simulator: true },
  android: { ...eas.build.production.android, buildType: "apk" },
};
writeFileSync(file, JSON.stringify(eas, null, 2));
console.log("eas.json: added the device-test profile");
