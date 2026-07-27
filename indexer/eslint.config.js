/**
 * ESLint 9 configuration (flat config format).
 * Docs: https://eslint.org/docs/latest/use/configure/configuration-files
 */
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".git/**",
      "fixtures/**",
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        // Top-level await and import.meta are available in Node 20+ ESM
        import: "readonly",
      },
    },
    rules: {
      // Use eslint:recommended as a base
      ...js.configs.recommended.rules,

      // ESM-specific rules
      "no-var": "error",
      "prefer-const": "error",

      // Code quality
      "no-console": "off", // Indexer uses console.log for ledger progress
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "eqeqeq": ["error", "always"],
      "curly": "error",
      "brace-style": ["error", "1tbs"],
      "comma-dangle": ["error", {
        arrays: "always-multiline",
        objects: "always-multiline",
        imports: "always-multiline",
        exports: "always-multiline",
        functions: "never",
      }],
      "quotes": ["error", "double", { avoidEscape: true }],
      "semi": ["error", "always"],
      // Disable indent — let Prettier handle formatting
      "indent": "off",
      "max-len": ["warn", { code: 100, ignoreUrls: true, ignoreStrings: true }],
    },
  },
];
