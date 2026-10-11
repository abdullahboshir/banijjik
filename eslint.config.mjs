import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import tseslint from "typescript-eslint";
import { architectureBlock } from "./eslint/architecture.mjs";
import { guardPlugin } from "./eslint/guard-plugin.mjs";
import { restrictionBlocks } from "./eslint/restrictions.mjs";
import {
  SCRIPT_FILES,
  SOURCE_FILES,
  TEST_FILES,
  TOOLING_FILES,
  TYPESCRIPT_FILES,
} from "./eslint/scopes.mjs";

const ERROR = "error";
const FORBIDDEN_ID_NAMES = [
  "orgId",
  "tenantId",
  "branchId",
  "outletId",
  "customerId",
  "supplierId",
  "storeId",
  "studentId",
  "patientId",
  "businessUnitId",
  "buId",
  "uid",
  "org_id",
  "user_id",
];
const LINE_COUNT_OPTIONS = { skipBlankLines: true, skipComments: true };

const namingConvention = [
  { selector: "variable", format: ["camelCase", "UPPER_CASE", "PascalCase"] },
  { selector: "function", format: ["camelCase"] },
  { selector: "typeLike", format: ["PascalCase"] },
];

export default defineConfig(
  {
    name: "banijjik/linter-options",
    // No inline eslint-disable or eslint-enable comment can switch a rule off: a rule changes in the
    // config or not at all (ADR-082, review finding J5e). The unused-directive report makes any
    // leftover comment visible as an error as well.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: ERROR },
  },
  {
    name: "banijjik/ignores",
    // Fixtures are linted only by tools/lint-tests, which uses the fixtures folder as its cwd.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/.next/**",
      "tools/lint-tests/fixtures/**",
    ],
  },
  {
    name: "banijjik/javascript",
    files: [...SCRIPT_FILES],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    name: "banijjik/typescript",
    files: TYPESCRIPT_FILES,
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": ERROR,
      "@typescript-eslint/no-floating-promises": ERROR,
      "@typescript-eslint/no-misused-promises": ERROR,
      "@typescript-eslint/no-non-null-assertion": ERROR,
      "@typescript-eslint/naming-convention": [ERROR, ...namingConvention],
    },
  },
  {
    name: "banijjik/react-components",
    files: ["**/*.tsx"],
    rules: {
      "@typescript-eslint/naming-convention": [
        ERROR,
        ...namingConvention.map((entry) =>
          entry.selector === "function" ? { ...entry, format: ["camelCase", "PascalCase"] } : entry,
        ),
      ],
    },
  },
  {
    name: "banijjik/readability",
    rules: {
      complexity: [ERROR, 10],
      "max-depth": [ERROR, 3],
      "max-params": [ERROR, 3],
      "no-nested-ternary": ERROR,
      "no-console": ERROR,
      "no-warning-comments": [ERROR, { terms: ["todo", "fixme", "hack"], location: "anywhere" }],
      "no-empty": [ERROR, { allowEmptyCatch: false }],
      "id-denylist": [ERROR, ...FORBIDDEN_ID_NAMES],
    },
  },
  {
    name: "banijjik/production-code-limits",
    ignores: TEST_FILES,
    rules: {
      "max-lines-per-function": [ERROR, { max: 60, ...LINE_COUNT_OPTIONS }],
      "max-lines": [ERROR, { max: 300, ...LINE_COUNT_OPTIONS }],
    },
  },
  {
    name: "banijjik/explicit-return-types",
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    rules: { "@typescript-eslint/explicit-module-boundary-types": ERROR },
  },
  {
    name: "banijjik/tooling-may-print",
    files: TOOLING_FILES,
    rules: { "no-console": "off" },
  },
  {
    name: "banijjik/tests-may-take-many-parameters",
    files: TEST_FILES,
    rules: { "max-params": "off" },
  },
  {
    name: "banijjik/express-error-handler-arity",
    files: ["**/kernel/http/error-handler.ts"],
    // Express identifies error middleware by exactly four parameters, so this one file may declare four.
    rules: { "max-params": [ERROR, 4] },
  },
  {
    name: "banijjik/next-recommended",
    files: ["apps/admin/**/*.{ts,tsx}", "apps/platform/**/*.{ts,tsx}"],
    ...nextPlugin.configs.recommended,
    settings: { next: { rootDir: ["apps/admin", "apps/platform"] } },
  },
  {
    name: "banijjik/next-core-web-vitals",
    files: ["apps/admin/**/*.{ts,tsx}", "apps/platform/**/*.{ts,tsx}"],
    ...nextPlugin.configs["core-web-vitals"],
  },
  {
    name: "banijjik/guard-plugin",
    plugins: { "banijjik-guard": guardPlugin },
  },
  ...restrictionBlocks,
  architectureBlock,
);
