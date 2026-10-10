// Path scopes shared by the rule blocks. Patterns start with `**/` so they match both the real
// tree (apps/api/src/modules/...) and the mirrored tree used by the fixtures in tools/lint-tests.

export const TEST_FILES = ["**/*.test.{ts,tsx,mjs}", "**/*.spec.{ts,tsx}"];
export const TYPESCRIPT_FILES = ["**/*.ts", "**/*.tsx"];
export const SCRIPT_FILES = ["**/*.mjs", "**/*.js"];
export const SOURCE_FILES = ["**/src/**/*.{ts,tsx}"];

export const TOOLING_FILES = ["scripts/**", "tools/**"];
export const CONFIG_FILES = ["**/src/config/**", "**/*.config.*", ...TOOLING_FILES];

export const INFRASTRUCTURE_FILES = ["**/infrastructure/**", "**/kernel/db/**"];
// R22 covers the domain layer of module folders only (modules/<group>/<module>/domain).
export const DOMAIN_FILES = ["**/modules/*/*/domain/**"];
export const MODULE_FILES = ["**/modules/**"];
// R28: the only places that may import the database drivers (ADR-023: business code goes through models(ctx)).
export const ORM_ALLOWED_FILES = [
  "**/infrastructure/**",
  "**/kernel/db/**",
  "**/kernel/sequence/**",
  "**/kernel/rate-limit/**",
  "**/test-support/**",
  ...TEST_FILES,
];
// R26: all module layers, repositories (infrastructure) included. Platform use cases are exempt (they must write an audit entry).
export const RUN_AS_SYSTEM_FORBIDDEN_FILES = [
  "**/modules/*/*/domain/**",
  "**/modules/*/*/application/**",
  "**/modules/*/*/infrastructure/**",
  "**/modules/*/*/presentation/**",
];
export const RUN_AS_SYSTEM_ALLOWED_FILES = ["**/modules/platform/**/application/**"];
export const PUBLIC_INDEX_FILES = ["**/index.ts"];
export const ID_PACKAGE_FILES = ["**/packages/ids/**"];
// Next apps keep their pages in app/ next to src/, so both folders are in scope.
export const BRAND_SCOPE_FILES = [
  "**/apps/*/{src,app}/**",
  "**/packages/ui/**",
  "**/packages/i18n/**",
];

// ADR-082: core/organization owns the industry key (09 section 4.2), so it may name the field but not branch on it.
export const INDUSTRY_KEY_OWNER_FILES = ["**/modules/core/organization/**"];

// ADR-033 / ADR-082: the only places allowed to read the organization's industry key.
export const INDUSTRY_READER_FILES = [
  "**/modules/platform/industry/**",
  "**/modules/platform/entitlement/**",
  "**/modules/core/organization/infrastructure/**",
  "**/packages/contracts/**",
  "**/packages/validation/**",
  ...TEST_FILES,
];
