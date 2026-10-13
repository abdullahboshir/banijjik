export type FixtureExpectation = {
  rule: string;
  path: string;
  /** Rule ids the fixture must report, each at least once and nothing else. Empty means "clean". */
  expectedRuleIds: string[];
};

const MODULE = "apps/api/src/modules/core/demo";
const BILLING = "apps/api/src/modules/core/billing";
const ORGANIZATION = "apps/api/src/modules/core/organization";
const SALES = "apps/api/src/modules/commerce/sales";
const BOUNDARIES = "boundaries/dependencies";
const INDUSTRY = "banijjik-guard/no-industry-branching";
const DOMAIN_IMPORTS = "banijjik-guard/no-domain-framework-imports";
const RUN_AS_SYSTEM = "banijjik-guard/no-run-as-system";
const RUN_AS_SYSTEM_IMPORT = "banijjik-guard/no-run-as-system-import";
const REQUEST_CONTEXT_IMPORT = "banijjik-guard/no-request-context-import";
const MIDDLEWARE_BYPASS = "banijjik-guard/no-middleware-bypass";
const RAW_COLLECTION = "banijjik-guard/no-raw-collection";
const ORM_IMPORTS = "banijjik-guard/no-orm-imports";
const NAMING = "@typescript-eslint/naming-convention";
const GUARD = "banijjik-guard";
const INLINE_CONFIG_IGNORED = "inline-config-ignored";
const READERS = [
  "apps/api/src/modules/platform/industry/application",
  "apps/api/src/modules/platform/entitlement/application",
  "apps/api/src/modules/core/organization/infrastructure",
  "packages/contracts/src",
  "packages/validation/src",
];

function fails(rule: string, path: string, ...expectedRuleIds: string[]): FixtureExpectation {
  return { rule, path, expectedRuleIds };
}

function passes(rule: string, path: string): FixtureExpectation {
  return { rule, path, expectedRuleIds: [] };
}

export const FIXTURE_EXPECTATIONS: FixtureExpectation[] = [
  fails("R01", "src/r01-no-any.fail.ts", "@typescript-eslint/no-explicit-any"),
  passes("R01", "src/r01-no-any.pass.ts"),

  fails("R02", "src/r02-floating-promise.fail.ts", "@typescript-eslint/no-floating-promises"),
  fails("R02", "src/r02-misused-promise.fail.ts", "@typescript-eslint/no-misused-promises"),
  passes("R02", "src/r02-floating-promise.pass.ts"),
  passes("R02", "src/r02-misused-promise.pass.ts"),

  fails("R03", "src/r03-return-types.fail.ts", "@typescript-eslint/explicit-module-boundary-types"),
  passes("R03", "src/r03-return-types.pass.ts"),
  passes("R03", "src/r03-return-types-in-tests.pass.test.ts"),

  fails("R04", "src/r04-function-length.fail.ts", "max-lines-per-function"),
  passes("R04", "src/r04-function-length.pass.ts"),
  passes("R04", "src/r04-function-length-in-tests.pass.test.ts"),

  fails("R05", "src/r05-file-length.fail.ts", "max-lines"),
  passes("R05", "src/r05-file-length.pass.ts"),
  passes("R05", "src/r05-file-length-in-tests.pass.test.ts"),

  fails("R06", "src/r06-complexity.fail.ts", "complexity"),
  fails("R06", "src/r06-depth.fail.ts", "max-depth"),
  fails("R06", "src/r06-params.fail.ts", "max-params"),
  fails(
    "R06",
    "apps/api/src/kernel/http/r06-four-params-outside-error-handler.fail.ts",
    "max-params",
  ),
  passes("R06", "apps/api/src/kernel/http/error-handler.ts"),
  passes("R06", "src/r06-complexity.pass.ts"),
  passes("R06", "src/r06-depth.pass.ts"),
  passes("R06", "src/r06-params-in-tests.pass.test.ts"),

  fails("R07", "src/r07-nested-ternary.fail.ts", "no-nested-ternary"),
  passes("R07", "src/r07-nested-ternary.pass.ts"),

  fails("R08", "src/r08-console.fail.ts", "no-console"),
  fails("R08", "src/r08-console-with-disable-comment.fail.ts", "no-console", INLINE_CONFIG_IGNORED),
  passes("R08", "src/r08-console.pass.ts"),
  passes("R08", "scripts/r08-console-in-scripts.pass.ts"),
  passes("R08", "tools/r08-console-in-tools.pass.ts"),

  fails("R09", "src/r09-empty-catch.fail.ts", "no-empty"),
  passes("R09", "src/r09-empty-catch.pass.ts"),

  fails("R10", "src/r10-naming-variable.fail.ts", NAMING),
  fails("R10", "src/r10-naming-function.fail.ts", NAMING),
  fails("R10", "src/r10-naming-function-pascal-in-ts.fail.ts", NAMING),
  fails("R10", "src/r10-naming-type.fail.ts", NAMING),
  passes("R10", "src/r10-naming.pass.ts"),
  passes("R10", "src/r10-naming-component.pass.tsx"),

  fails("R11", "src/r11-uuid-import.fail.ts", "banijjik-guard/no-id-generator-imports"),
  fails("R11", "src/r11-nanoid-import.fail.ts", "banijjik-guard/no-id-generator-imports"),
  fails("R11", "src/r11-crypto-import.fail.ts", "banijjik-guard/no-id-generator-imports"),
  fails("R11", "src/r11-random-uuid-call.fail.ts", "banijjik-guard/no-random-uuid-call"),
  fails("R11", "src/r11-dynamic-import-nanoid.fail.ts", `${GUARD}/no-id-generator-dynamic-import`),
  passes("R11", "src/r11-new-id.pass.ts"),
  passes("R11", "packages/ids/src/r11-generator-in-ids-package.pass.ts"),

  fails("R12", "src/r12-banned-identifier.fail.ts", "id-denylist"),
  fails("R12", "src/r12-banned-property.fail.ts", "id-denylist"),
  fails("R12", "src/r12-banned-store-id.fail.ts", "id-denylist"),
  passes("R12", "src/r12-domain-identifiers.pass.ts"),

  fails("R13", "src/r13-underscore-id.fail.ts", "banijjik-guard/no-underscore-id"),
  fails("R13", "src/r13-underscore-id-literal.fail.ts", "banijjik-guard/no-underscore-id"),
  fails("R13", "src/r13-underscore-id-aggregation-path.fail.ts", `${GUARD}/no-underscore-id`),
  fails("R13", "src/r13-underscore-id-template.fail.ts", `${GUARD}/no-underscore-id`),
  passes("R13", `${MODULE}/infrastructure/r13-underscore-id-in-infrastructure.pass.ts`),
  passes("R13", "apps/api/src/kernel/db/r13-underscore-id-in-kernel-db.pass.ts"),
  passes("R13", "src/r13-underscore-id-in-tests.pass.test.ts"),
  passes("R13", "src/r13-domain-id.pass.ts"),

  fails("R14", "apps/web/src/r14-brand-name.fail.ts", "banijjik-guard/no-brand-name-literal"),
  fails(
    "R14",
    "apps/web/src/r14-brand-name-template.fail.ts",
    "banijjik-guard/no-brand-name-literal",
  ),
  fails("R14", "apps/web/app/r14-brand-name-app-folder.fail.ts", `${GUARD}/no-brand-name-literal`),
  fails("R14", "apps/web/src/r14-brand-name-jsx.fail.tsx", `${GUARD}/no-brand-name-literal`),
  passes("R14", "apps/web/src/r14-brand-name-in-imports.pass.ts"),
  passes("R14", "apps/web/src/r14-jsx-text.pass.tsx"),
  passes("R14", "packages/validation/src/r14-brand-name-outside-ui.pass.ts"),

  fails("R15", "src/r15-process-env.fail.ts", "banijjik-guard/no-process-env"),
  fails("R15", "src/r15-process-env-import.fail.ts", `${GUARD}/no-process-env-import`),
  fails("R15", "src/r15-global-this-process-env.fail.ts", `${GUARD}/no-process-env-syntax`),
  passes("R15", "src/r15-process-import-other-name.pass.ts"),
  passes("R15", "apps/api/src/config/r15-process-env-in-config.pass.ts"),
  passes("R15", "scripts/r15-process-env-in-scripts.pass.ts"),
  passes("R15", "tools/r15-process-env-in-tools.pass.ts"),
  passes("R15", "r15-process-env.pass.config.ts"),
  passes("R15", "src/r15-process-name.pass.ts"),

  fails("R16", `${BILLING}/application/r16-industry-key.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-comparison.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-variable-comparison.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-switch.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-includes.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-computed-lookup.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-key-computed.fail.ts`, INDUSTRY),
  passes("R16", `${BILLING}/application/r16-includes-other-value.pass.ts`),
  passes("R16", `${BILLING}/application/r16-status-comparison.pass.ts`),
  passes("R16", `${BILLING}/application/r16-industry-in-tests.pass.test.ts`),
  // core/organization owns the key: it may carry the field, but not compare or switch on it.
  passes("R16", `${ORGANIZATION}/domain/r16-industry-key-stored.pass.ts`),
  fails("R16", `${ORGANIZATION}/domain/r16-industry-key-compared.fail.ts`, INDUSTRY),
  fails("R16", `${ORGANIZATION}/application/r16-industry-key-switch.fail.ts`, INDUSTRY),
  fails("R16", `${SALES}/application/r16-industry-key-outside-organization.fail.ts`, INDUSTRY),
  ...READERS.map((folder) => passes("R16", `${folder}/r16-industry-reader-allowed.pass.ts`)),

  fails("R17", "src/r17-model-import.fail.ts", "banijjik-guard/no-model-imports"),
  fails("R17", "src/r17-persistence-models-import.fail.ts", "banijjik-guard/no-model-imports"),
  passes("R17", `${MODULE}/infrastructure/r17-model-import.pass.ts`),
  passes("R17", "apps/api/src/kernel/db/r17-model-import-in-kernel.pass.ts"),

  fails("R18", `${MODULE}/domain/r18-layers.fail.ts`, BOUNDARIES),
  fails("R18", `${MODULE}/domain/r18-other-module.fail.ts`, BOUNDARIES),
  fails("R18", `${MODULE}/application/r18-infrastructure.fail.ts`, BOUNDARIES),
  fails("R18", `${MODULE}/application/r18-presentation.fail.ts`, BOUNDARIES),
  fails("R18", `${MODULE}/infrastructure/r18-presentation.fail.ts`, BOUNDARIES),
  fails("R18", `${MODULE}/presentation/r18-infrastructure.fail.ts`, BOUNDARIES),
  passes("R18", `${MODULE}/domain/r18-layers.pass.ts`),
  passes("R18", `${MODULE}/application/r18-layers.pass.ts`),
  passes("R18", `${MODULE}/infrastructure/r18-layers.pass.ts`),
  passes("R18", `${MODULE}/presentation/r18-layers.pass.ts`),

  fails("R19", `${MODULE}/application/r19-deep-import.fail.ts`, BOUNDARIES),
  fails("R19", `${MODULE}/application/r19-deep-import-other-group.fail.ts`, BOUNDARIES),
  passes("R19", `${MODULE}/application/r19-entry-import.pass.ts`),

  fails("R20", "src/r20-deep-src-import.fail.ts", "banijjik-guard/no-deep-package-imports"),
  fails("R20", "src/r20-deep-dist-import.fail.ts", "banijjik-guard/no-deep-package-imports"),
  passes("R20", "src/r20-public-entry-import.pass.ts"),

  fails("R21", "r21-star-export/fail/index.ts", "banijjik-guard/no-export-star"),
  passes("R21", "r21-star-export/pass/index.ts"),
  passes("R21", "r21-star-export/pass/barrel.ts"),

  fails("R22", `${MODULE}/domain/r22-framework-import.fail.ts`, DOMAIN_IMPORTS),
  fails("R22", `${MODULE}/domain/r22-node-builtin.fail.ts`, DOMAIN_IMPORTS),
  fails("R22", `${MODULE}/domain/r22-bare-node-builtin.fail.ts`, DOMAIN_IMPORTS),
  fails("R22", `${MODULE}/domain/r22-validation-package.fail.ts`, DOMAIN_IMPORTS),
  fails("R22", `${MODULE}/domain/r22-date-library.fail.ts`, DOMAIN_IMPORTS),
  passes("R22", `${MODULE}/domain/r22-allowed-imports.pass.ts`),
  passes("R22", `${MODULE}/domain/r22-relative-parent.pass.ts`),
  passes("R22", `${MODULE}/domain/r22-test-imports-vitest.pass.test.ts`),
  passes("R22", `${MODULE}/application/r22-framework-allowed-outside-domain.pass.ts`),
  fails("R23", "apps/api/src/kernel/http/r23-kernel-imports-module.fail.ts", BOUNDARIES),
  passes("R23", "apps/api/src/kernel/http/r23-kernel-imports-config.pass.ts"),

  fails("R24", "apps/api/src/config/r24-config-imports-kernel.fail.ts", BOUNDARIES),
  fails("R24", "apps/api/src/config/r24-config-imports-module.fail.ts", BOUNDARIES),
  passes("R24", "apps/api/src/config/r24-config-imports-config.pass.ts"),

  fails("R25", "apps/api/src/routes/r25-routes-import-module-internals.fail.ts", BOUNDARIES),
  passes("R25", "apps/api/src/routes/r25-routes-import-index-and-kernel.pass.ts"),

  fails(
    "R26",
    `${MODULE}/application/r26-run-as-system.fail.ts`,
    RUN_AS_SYSTEM,
    RUN_AS_SYSTEM_IMPORT,
  ),
  fails("R26", `${MODULE}/domain/r26-run-as-system.fail.ts`, RUN_AS_SYSTEM, RUN_AS_SYSTEM_IMPORT),
  fails(
    "R26",
    `${MODULE}/presentation/r26-run-as-system.fail.ts`,
    RUN_AS_SYSTEM,
    RUN_AS_SYSTEM_IMPORT,
  ),
  fails(
    "R26",
    "apps/api/src/modules/commerce/sales/infrastructure/r26-run-as-system-in-repository.fail.ts",
    RUN_AS_SYSTEM,
    RUN_AS_SYSTEM_IMPORT,
  ),
  fails(
    "R26",
    "apps/api/src/modules/platform/demo/application/r26-run-as-system-in-unlisted-platform-application.fail.ts",
    RUN_AS_SYSTEM,
    RUN_AS_SYSTEM_IMPORT,
  ),
  // Finding J3: module root files and composition files are module code too.
  fails("R26", `${ORGANIZATION}/index.ts`, RUN_AS_SYSTEM, RUN_AS_SYSTEM_IMPORT),
  fails(
    "R26",
    `${ORGANIZATION}/r26-run-as-system.composition.fail.ts`,
    RUN_AS_SYSTEM,
    RUN_AS_SYSTEM_IMPORT,
  ),
  // A file on the explicit SYSTEM_ACCESS_FILES list (eslint/scopes.mjs) may call it.
  passes(
    "R26",
    "apps/api/src/modules/platform/tenant-admin/application/use-cases/list-tenants.use-case.ts",
  ),
  passes("R26", `${MODULE}/application/r26-run-as-system-in-tests.pass.test.ts`),
  passes("R26", "apps/api/src/kernel/context/r26-run-as-system-in-kernel.pass.ts"),
  passes("R26", "apps/api/src/seeds/r26-run-as-system-in-seeds.pass.ts"),

  fails(
    "R26",
    `${MODULE}/application/r26-run-as-system-alias-import.fail.ts`,
    RUN_AS_SYSTEM_IMPORT,
  ),
  fails(
    "R26",
    `${MODULE}/application/r26-run-as-system-namespace-import.fail.ts`,
    // A namespace import of the kernel could use any name, so both kernel-name rules report it.
    RUN_AS_SYSTEM_IMPORT,
    REQUEST_CONTEXT_IMPORT,
  ),
  fails("R26", `${MODULE}/application/r26-run-as-system-member-call.fail.ts`, RUN_AS_SYSTEM),

  fails(
    "R27",
    `${MODULE}/application/r27-run-with-request-context.fail.ts`,
    REQUEST_CONTEXT_IMPORT,
  ),
  passes("R27", `${MODULE}/application/r27-request-context-in-tests.pass.test.ts`),
  passes("R27", "apps/api/src/kernel/http/r27-request-context-in-kernel.pass.ts"),
  passes("R27", "apps/api/src/test-support/r27-request-context-in-test-support.pass.ts"),
  fails("R27", `${MODULE}/application/r27-as-system-port.fail.ts`, REQUEST_CONTEXT_IMPORT),
  fails(
    "R27",
    `${MODULE}/application/r27-run-in-organization-context.fail.ts`,
    REQUEST_CONTEXT_IMPORT,
  ),
  passes("R27", "apps/api/src/routes/r27-bypass-helpers-in-composition-root.pass.ts"),

  fails("R28", `${MODULE}/application/r28-mongoose-in-application.fail.ts`, ORM_IMPORTS),
  fails("R28", `${MODULE}/presentation/r28-mongodb-type-in-presentation.fail.ts`, ORM_IMPORTS),
  passes("R28", `${MODULE}/infrastructure/r28-mongoose-in-infrastructure.pass.ts`),
  passes("R28", "apps/api/src/kernel/db/r28-mongoose-in-kernel-db.pass.ts"),
  passes("R28", "apps/api/src/kernel/sequence/r28-mongoose-in-kernel-sequence.pass.ts"),
  passes("R28", "apps/api/src/kernel/rate-limit/r28-mongoose-in-kernel-rate-limit.pass.ts"),
  passes("R28", "apps/api/src/kernel/idempotency/r28-mongoose-in-kernel-idempotency.pass.ts"),
  passes("R28", "apps/api/src/kernel/events/r28-mongoose-in-kernel-events.pass.ts"),
  passes("R28", "apps/api/src/test-support/r28-mongoose-in-test-support.pass.ts"),
  passes("R28", "src/r28-mongoose-in-tests.pass.test.ts"),

  fails("R29", "src/r29-then-chain.fail.ts", `${GUARD}/no-then-chain`),
  passes("R29", "src/r29-await.pass.ts"),

  fails("R30", "src/r30-ssr-false.fail.ts", `${GUARD}/no-ssr-false`),
  passes("R30", "src/r30-ssr-true.pass.ts"),

  fails("R31", "src/r31-local-storage.fail.ts", "no-restricted-globals"),
  passes("R31", "src/r31-storage-name-as-key.pass.ts"),

  fails("R32", "src/r32-todo-comment.fail.ts", "no-warning-comments"),
  passes("R32", "src/r32-plain-comment.pass.ts"),

  fails("R33", "src/r33-non-null-assertion.fail.ts", "@typescript-eslint/no-non-null-assertion"),
  passes("R33", "src/r33-checked-access.pass.ts"),

  fails("R35", `${MODULE}/infrastructure/r35-raw-collection.fail.ts`, RAW_COLLECTION),
  fails("R35", `${MODULE}/infrastructure/r35-raw-db-collection.fail.ts`, RAW_COLLECTION),
  fails("R35", `${MODULE}/infrastructure/r35-change-stream.fail.ts`, RAW_COLLECTION),
  passes("R35", "apps/api/src/kernel/db/r35-raw-collection-in-kernel.pass.ts"),
  passes("R35", `${MODULE}/infrastructure/r35-raw-collection-in-tests.pass.test.ts`),

  fails("R36", `${SALES}/infrastructure/r36-middleware-option.fail.ts`, MIDDLEWARE_BYPASS),
  fails("R36", `${SALES}/infrastructure/r36-set-options.fail.ts`, MIDDLEWARE_BYPASS),
  fails("R36", `${SALES}/infrastructure/r36-skip-middleware-function.fail.ts`, MIDDLEWARE_BYPASS),
  fails("R36", `${SALES}/infrastructure/r36-option-assigned.fail.ts`, MIDDLEWARE_BYPASS),
  passes("R36", `${SALES}/infrastructure/r36-ordinary-options.pass.ts`),
  passes("R36", `${SALES}/infrastructure/r36-middleware-option-in-tests.pass.test.ts`),
  passes("R36", "apps/api/src/kernel/db/r36-middleware-option-in-kernel.pass.ts"),

  fails("R34", "apps/api/src/seeds/r34-seeds-import-module-internals.fail.ts", BOUNDARIES),
  passes("R34", "apps/api/src/seeds/r34-seeds-import-index-kernel-config.pass.ts"),
];
