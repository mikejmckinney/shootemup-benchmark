import eslint from "@eslint/js";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        AudioContext: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLInputElement: "readonly",
        Node: "readonly",
        document: "readonly",
        fetch: "readonly",
        getComputedStyle: "readonly",
        navigator: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
];
