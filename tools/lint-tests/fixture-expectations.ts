export type FixtureExpectation = {
  rule: string;
  path: string;
  /** Rule ids the fixture must report, each at least once and nothing else. Empty means "clean". */
  expectedRuleIds: string[];
};

const MODULE = "apps/api/src/modules/core/demo";
const BILLING = "apps/api/src/modules/core/billing";
const BOUNDARIES = "boundaries/dependencies";
const INDUSTRY = "banijjik-guard/no-industry-branching";
const DOMAIN_IMPORTS = "banijjik-guard/no-domain-framework-imports";
const NAMING = "@typescript-eslint/naming-convention";
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
  passes("R06", "src/r06-complexity.pass.ts"),
  passes("R06", "src/r06-depth.pass.ts"),
  passes("R06", "src/r06-params-in-tests.pass.test.ts"),

  fails("R07", "src/r07-nested-ternary.fail.ts", "no-nested-ternary"),
  passes("R07", "src/r07-nested-ternary.pass.ts"),

  fails("R08", "src/r08-console.fail.ts", "no-console"),
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
  passes("R11", "src/r11-new-id.pass.ts"),
  passes("R11", "packages/ids/src/r11-generator-in-ids-package.pass.ts"),

  fails("R12", "src/r12-banned-identifier.fail.ts", "id-denylist"),
  fails("R12", "src/r12-banned-property.fail.ts", "id-denylist"),
  passes("R12", "src/r12-domain-identifiers.pass.ts"),

  fails("R13", "src/r13-underscore-id.fail.ts", "banijjik-guard/no-underscore-id"),
  fails("R13", "src/r13-underscore-id-literal.fail.ts", "banijjik-guard/no-underscore-id"),
  passes("R13", `${MODULE}/infrastructure/r13-underscore-id-in-infrastructure.pass.ts`),
  passes("R13", "src/r13-underscore-id-in-tests.pass.test.ts"),
  passes("R13", "src/r13-domain-id.pass.ts"),

  fails("R14", "apps/web/src/r14-brand-name.fail.ts", "banijjik-guard/no-brand-name-literal"),
  fails(
    "R14",
    "apps/web/src/r14-brand-name-template.fail.ts",
    "banijjik-guard/no-brand-name-literal",
  ),
  passes("R14", "apps/web/src/r14-brand-name-in-imports.pass.ts"),
  passes("R14", "packages/validation/src/r14-brand-name-outside-ui.pass.ts"),

  fails("R15", "src/r15-process-env.fail.ts", "banijjik-guard/no-process-env"),
  passes("R15", "apps/api/src/config/r15-process-env-in-config.pass.ts"),
  passes("R15", "scripts/r15-process-env-in-scripts.pass.ts"),
  passes("R15", "tools/r15-process-env-in-tools.pass.ts"),
  passes("R15", "r15-process-env.pass.config.ts"),
  passes("R15", "src/r15-process-name.pass.ts"),

  fails("R16", `${BILLING}/application/r16-industry-key.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-comparison.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-variable-comparison.fail.ts`, INDUSTRY),
  fails("R16", `${BILLING}/application/r16-industry-switch.fail.ts`, INDUSTRY),
  passes("R16", `${BILLING}/application/r16-status-comparison.pass.ts`),
  passes("R16", `${BILLING}/application/r16-industry-in-tests.pass.test.ts`),
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
  passes("R22", `${MODULE}/domain/r22-allowed-imports.pass.ts`),
  passes("R22", `${MODULE}/application/r22-framework-allowed-outside-domain.pass.ts`),
  fails("R23", "apps/api/src/kernel/http/r23-kernel-imports-module.fail.ts", BOUNDARIES),
  passes("R23", "apps/api/src/kernel/http/r23-kernel-imports-config.pass.ts"),

  fails("R24", "apps/api/src/config/r24-config-imports-kernel.fail.ts", BOUNDARIES),
  fails("R24", "apps/api/src/config/r24-config-imports-module.fail.ts", BOUNDARIES),
  passes("R24", "apps/api/src/config/r24-config-imports-config.pass.ts"),

  fails("R25", "apps/api/src/routes/r25-routes-import-module-internals.fail.ts", BOUNDARIES),
  passes("R25", "apps/api/src/routes/r25-routes-import-index-and-kernel.pass.ts"),
];
