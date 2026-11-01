const fs = require("node:fs");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

/**
 * qa-sim only. app.config.ts adds this plugin when EAS_BUILD_PROFILE is
 * "qa-sim", and never for any other profile.
 *
 * The qa-sim APK talks to the host machine over plain HTTP
 * (http://10.0.2.2:3108 on the Android emulator, http://localhost:3108). A
 * release build with targetSdk 28 or higher blocks cleartext traffic, so this
 * writes a network security config that allows it for those two hosts only
 * and keeps cleartext off for every other host. It does not set
 * android:usesCleartextTraffic.
 */
const QA_SIM_CLEARTEXT_HOSTS = ["10.0.2.2", "localhost"];

const NETWORK_SECURITY_CONFIG_ATTRIBUTE = "android:networkSecurityConfig";
const NETWORK_SECURITY_CONFIG_REFERENCE = "@xml/network_security_config";
const NETWORK_SECURITY_CONFIG_PATH = [
  "app",
  "src",
  "main",
  "res",
  "xml",
  "network_security_config.xml",
];

function buildNetworkSecurityConfigXml(hosts = QA_SIM_CLEARTEXT_HOSTS) {
  const domains = hosts
    .map((host) => `    <domain includeSubdomains="false">${host}</domain>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<network-security-config>",
    '  <base-config cleartextTrafficPermitted="false" />',
    '  <domain-config cleartextTrafficPermitted="true">',
    domains,
    "  </domain-config>",
    "</network-security-config>",
    "",
  ].join("\n");
}

function setNetworkSecurityConfig(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.$[NETWORK_SECURITY_CONFIG_ATTRIBUTE] = NETWORK_SECURITY_CONFIG_REFERENCE;
  return androidManifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withQaSimNetworkSecurity(config) {
  config = withAndroidManifest(config, (config) => {
    config.modResults = setNetworkSecurityConfig(config.modResults);
    return config;
  });
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        ...NETWORK_SECURITY_CONFIG_PATH,
      );
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buildNetworkSecurityConfigXml());
      return config;
    },
  ]);
}

module.exports = withQaSimNetworkSecurity;
module.exports.QA_SIM_CLEARTEXT_HOSTS = QA_SIM_CLEARTEXT_HOSTS;
module.exports.NETWORK_SECURITY_CONFIG_REFERENCE = NETWORK_SECURITY_CONFIG_REFERENCE;
module.exports.buildNetworkSecurityConfigXml = buildNetworkSecurityConfigXml;
module.exports.setNetworkSecurityConfig = setNetworkSecurityConfig;
