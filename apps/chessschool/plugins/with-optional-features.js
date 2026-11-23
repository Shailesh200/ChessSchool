// Play reads a portrait-locked app and Wi-Fi state access as hard requirements and hides the app from
// devices without them (some tablets, Chromebooks, XR). Neither is needed, so declare both optional.
const { withAndroidManifest } = require("expo/config-plugins");

const OPTIONAL = ["android.hardware.screen.portrait", "android.hardware.wifi"];

module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    m["uses-feature"] = (m["uses-feature"] ?? []).filter((f) => !OPTIONAL.includes(f.$["android:name"]));
    for (const name of OPTIONAL) m["uses-feature"].push({ $: { "android:name": name, "android:required": "false" } });
    return c;
  });
