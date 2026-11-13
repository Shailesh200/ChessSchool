/** @param {string | [string, unknown] | unknown} entry */
function pluginName(entry) {
  return Array.isArray(entry) ? entry[0] : entry;
}

function isGoogleScheme(value) {
  return typeof value === "string" && value.includes("googleusercontent");
}

/**
 * Drop Google URL schemes already written into the static config.
 * The google-signin plugin is removed separately so it cannot add one at prebuild.
 * @param {unknown} types
 */
function withoutGoogleUrlTypes(types) {
  if (!Array.isArray(types)) return types;
  return types
    .map((item) => {
      if (!item || typeof item !== "object" || !Array.isArray(item.CFBundleURLSchemes)) return item;
      const schemes = item.CFBundleURLSchemes.filter((scheme) => !isGoogleScheme(scheme));
      if (schemes.length === 0) return null;
      return { ...item, CFBundleURLSchemes: schemes };
    })
    .filter(Boolean);
}

module.exports = ({ config }) => {
  if (process.env.CS_DISABLE_GOOGLE !== "1") return config;

  const next = { ...config };
  if (Array.isArray(config.plugins)) {
    next.plugins = config.plugins.filter((entry) => pluginName(entry) !== "@react-native-google-signin/google-signin");
  }
  if (Array.isArray(config.scheme)) {
    next.scheme = config.scheme.filter((scheme) => !isGoogleScheme(scheme));
  } else if (isGoogleScheme(config.scheme)) {
    delete next.scheme;
  }
  const urlTypes = config.ios?.infoPlist?.CFBundleURLTypes;
  if (urlTypes) {
    const kept = withoutGoogleUrlTypes(urlTypes);
    const infoPlist = { ...config.ios.infoPlist };
    if (kept.length === 0) delete infoPlist.CFBundleURLTypes;
    else infoPlist.CFBundleURLTypes = kept;
    next.ios = { ...config.ios, infoPlist };
  }
  return next;
};
