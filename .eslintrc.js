module.exports = {
  rules: {
    "no-debugger": "off",
    "no-redeclare": "off",
    "no-dupe-class-members": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-var": "error",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-shadow": "off",
    "@typescript-eslint/no-shadow": "error",
    "@typescript-eslint/no-floating-promises": ["error", {}],
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "no-inner-declarations": "off",
  },
  env: {
    es6: true,
    node: true,
    browser: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
  },
  ignorePatterns: ["node_modules", "**/*.js"],
  plugins: ["@typescript-eslint", "react"],
  extends: ["eslint:recommended", "next"],
};
