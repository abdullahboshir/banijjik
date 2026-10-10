// Path scopes shared by the rule blocks. Patterns start with `**/` so they match both the real
// tree (apps/api/src/modules/...) and the mirrored tree used by the fixtures in tools/lint-tests.

export const TEST_FILES = ["**/*.test.{ts,tsx,mjs}", "**/*.spec.{ts,tsx}"];
export const TYPESCRIPT_FILES = ["**/*.ts", "**/*.tsx"];
export const SCRIPT_FILES = ["**/*.mjs", "**/*.js"];
export const SOURCE_FILES = ["**/src/**/*.{ts,tsx}"];

export const TOOLING_FILES = ["scripts/**", "tools/**"];
export const CONFIG_FILES = ["**/src/config/**", "**/*.config.*", ...TOOLING_FILES];

export const INFRASTRUCTURE_FILES = ["**/infrastructure/**", "**/kernel/db/**"];
export const DOMAIN_FILES = ["**/domain/**"];
export const PUBLIC_INDEX_FILES = ["**/index.ts"];
export const ID_PACKAGE_FILES = ["**/packages/ids/**"];
export const BRAND_SCOPE_FILES = ["**/apps/*/src/**", "**/packages/ui/**", "**/packages/i18n/**"];

// ADR-033 / ADR-082: the only places allowed to read the organization's industry key.
export const INDUSTRY_READER_FILES = [
  "**/modules/platform/industry/**",
  "**/modules/platform/entitlement/**",
  "**/modules/core/organization/infrastructure/**",
  "**/packages/contracts/**",
  "**/packages/validation/**",
  ...TEST_FILES,
];
