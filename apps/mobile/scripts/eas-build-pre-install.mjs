#!/usr/bin/env node
/**
 * EAS hook (`eas-build-pre-install`). Production and preview builds must not
 * see EXPO_PUBLIC_PARITY. That flag turns the login screen into an open
 * deep-link auto-login, which must stay on parity/dev builds only.
 *
 * EAS runs this before dependencies install, so it stays dependency-free.
 * Any value counts as set, including "" and "0".
 */
const profile = process.env.EAS_BUILD_PROFILE?.trim();
const flag = process.env.EXPO_PUBLIC_PARITY;

if ((profile === "production" || profile === "preview") && flag !== undefined) {
  console.error(
    `eas-build-pre-install: refusing ${profile} build because EXPO_PUBLIC_PARITY is set to ${JSON.stringify(flag)}. Production and preview builds must not include the parity auto-login deep link.`,
  );
  process.exit(1);
}
