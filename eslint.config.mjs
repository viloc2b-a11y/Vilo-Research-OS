import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".venv/**",
      "out/**",
      "build/**",
      "scripts/**",
      "tests/**",
      "next-env.d.ts",
      "vilo-os UX/**",
      "Vilo Scientific Events/**",
    ],
  },
  {
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // Phase 6: clinical spine enforcement is enforced via `npm run integrity:audit`
  // (lib/runtime-integrity/detect/direct-mutation-scanner.ts), not ESLint selectors.
];

export default eslintConfig;
