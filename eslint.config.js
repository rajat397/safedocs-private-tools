const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "error",
    },
  },
  {
    files: ["bench/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules", "bench/corpus", "bench/results", "vendor"],
  },
];