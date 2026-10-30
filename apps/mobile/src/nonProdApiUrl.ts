const PRODUCTION_PROFILE = "production";
const PRODUCTION_HOST = "chess-school.in";

type BuildEnv = {
  EAS_BUILD_PROFILE?: string;
  APP_VARIANT?: string;
  EXPO_PUBLIC_API_URL?: string;
};

function declaredName(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * EAS sets EAS_BUILD_PROFILE. A local Gradle build does not, so it declares
 * itself with APP_VARIANT (for example APP_VARIANT=test). When neither is
 * set, the build is production and the existing API fallback stays.
 */
export function isNonProductionBuild(env: BuildEnv = process.env): boolean {
  const profile = declaredName(env.EAS_BUILD_PROFILE);
  if (profile !== undefined) return profile !== PRODUCTION_PROFILE;
  const variant = declaredName(env.APP_VARIANT);
  if (variant !== undefined) return variant !== PRODUCTION_PROFILE;
  return false;
}

/** True when the URL host is chess-school.in or a subdomain of it. */
export function apiUrlPointsAtProduction(raw: string): boolean {
  const trimmed = raw.trim();
  let hostname: string;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    hostname = new URL(withScheme).hostname.replace(/\.$/, "").toLowerCase();
  } catch {
    return trimmed.toLowerCase().includes(PRODUCTION_HOST);
  }
  return hostname === PRODUCTION_HOST || hostname.endsWith(`.${PRODUCTION_HOST}`);
}

/** Fail a non-production build that would talk to the production API. */
export function assertNonProductionApiUrl(raw: string | undefined): void {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") {
    throw new Error(
      "Non-production build requires EXPO_PUBLIC_API_URL. Unset, it would fall back to https://www.chess-school.in.",
    );
  }
  if (apiUrlPointsAtProduction(trimmed)) {
    throw new Error(
      "Non-production build refuses EXPO_PUBLIC_API_URL that points at chess-school.in.",
    );
  }
}
