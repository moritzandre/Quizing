import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist", "coverage"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Shared/hook/provider modules legitimately export non-components alongside
  // components (style tokens, palettes, helpers); fast-refresh granularity N/A.
  {
    files: ["**/useRoom.js", "**/I18nProvider.jsx", "**/ui.jsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  prettier,
];
