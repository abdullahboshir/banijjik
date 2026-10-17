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
  "**/kernel/idempotency/**",
  "**/kernel/events/**",
  "**/test-support/**",
  ...TEST_FILES,
];
// R26 and R27: every file under modules/, root files (index.ts, *.composition.ts) included. Only the
// files below may call runAsSystem. Each is a platform admin use case that writes an audit entry.
// A new platform use case that needs system access is added here in the same commit, so the bypass
// shows up in review (plan 1.9b, ADR-087). Patterns start with `**/` like the rest of this file.
export const SYSTEM_ACCESS_FILES = [
  "**/modules/core/file/application/use-cases/read-public-file.use-case.ts",
  "**/modules/platform/entitlement/application/use-cases/create-module-override.use-case.ts",
  "**/modules/platform/entitlement/application/use-cases/delete-module-override.use-case.ts",
  "**/modules/platform/entitlement/application/use-cases/list-module-overrides.use-case.ts",
  "**/modules/platform/package/application/use-cases/archive-package.use-case.ts",
  "**/modules/platform/saas-billing/application/use-cases/change-package.use-case.ts",
  "**/modules/platform/saas-billing/application/use-cases/extend-trial.use-case.ts",
  "**/modules/platform/saas-billing/application/use-cases/get-subscription.use-case.ts",
  "**/modules/platform/tenant-admin/application/use-cases/get-tenant.use-case.ts",
  "**/modules/platform/tenant-admin/application/use-cases/list-tenants.use-case.ts",
];
export const PUBLIC_INDEX_FILES = ["**/index.ts"];
export const ID_PACKAGE_FILES = ["**/packages/ids/**"];
// Next apps keep their pages in app/ next to src/, so both folders are in scope.
export const BRAND_SCOPE_FILES = [
  "**/apps/*/{src,app}/**",
  "**/packages/ui/**",
  "**/packages/i18n/**",
];

// ADR-082: core/organization owns the industry key (09 section 4.2), so it may name the field but not branch on it.
// These files may name industryTemplateKey. Comparison selectors still apply (ADR-033, ADR-106).
export const INDUSTRY_KEY_OWNER_FILES = [
  "**/modules/core/organization/**",
  "apps/platform/src/industry-templates/**",
  "apps/platform/src/tenants/change-industry-sheet.tsx",
  "apps/platform/src/tenants/tenant-action-labels.ts",
  "apps/platform/src/tenants/tenant-detail-page.tsx",
  "apps/platform/src/test-support/browser-stack.ts",
];

// ADR-033 / ADR-082: the only places allowed to read the organization's industry key.
export const INDUSTRY_READER_FILES = [
  "**/modules/platform/industry/**",
  "**/modules/platform/entitlement/**",
  "**/modules/core/organization/infrastructure/**",
  "**/packages/contracts/**",
  "**/packages/validation/**",
  ...TEST_FILES,
];
