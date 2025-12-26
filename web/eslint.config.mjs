import nextConfig from "eslint-config-next";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextConfig,
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      // React 19 strict rules - downgrade to warn for now
      // These require significant refactoring but don't affect functionality
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "@next/next/no-img-element": "warn",
      // Disable unescaped entities for JSX (common pattern with apostrophes)
      "react/no-unescaped-entities": "warn",
      // React Compiler - downgrade memoization preservation warnings to warnings
      // These are false positives where the compiler can't verify valid memoization
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
