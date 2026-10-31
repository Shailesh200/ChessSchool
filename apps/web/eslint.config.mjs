import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Stockfish engine (minified WASM loader) — not ours to lint.
    "public/engine/**",
    // Storybook static export (local `build-storybook` artifact).
    "storybook-static/**",
  ]),
  {
    // GT lint scope: lesson/play/class/onboarding paths deferred (listed in release notes).
    files: [
      "features/lessons/**/*.{ts,tsx}",
      "features/play/**/*.{ts,tsx}",
      "features/premium-ui/screens/PremiumClassDetailView.tsx",
      "features/premium-ui/screens/PremiumOnboardingWizard.tsx",
      "components/onboarding/**/*.{ts,tsx}",
      "app/**/lesson/**/*.{ts,tsx}",
      "app/**/play/**/*.{ts,tsx}",
      "app/**/class/**/*.{ts,tsx}",
      "app/**/onboarding/**/*.{ts,tsx}",
    ],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
