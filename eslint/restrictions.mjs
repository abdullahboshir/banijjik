import {
  BRAND_SCOPE_FILES,
  CONFIG_FILES,
  DOMAIN_FILES,
  ID_PACKAGE_FILES,
  INDUSTRY_KEY_OWNER_FILES,
  INDUSTRY_READER_FILES,
  INFRASTRUCTURE_FILES,
  MODULE_FILES,
  ORM_ALLOWED_FILES,
  PUBLIC_INDEX_FILES,
  RUN_AS_SYSTEM_ALLOWED_FILES,
  RUN_AS_SYSTEM_FORBIDDEN_FILES,
  TEST_FILES,
} from "./scopes.mjs";

import {
  brandSelectors,
  industryComparisonSelectors,
  industrySelectors,
  processEnvSyntax,
  syntaxRules,
  underscoreIdSelectors,
} from "./selectors.mjs";

const ERROR = "error";
const RANDOM_UUID_MESSAGE =
  "Use newId() from @banijjik/ids; it is the only ID generator (ADR-036).";
// runAsSystem and runWithRequestContext are exported by the kernel; whatever path or alias reaches the kernel is covered.
// A namespace import (`import * as x`) from the kernel is reported too, because importNames cannot tell which names it uses.
const KERNEL_MODULES = ["**/kernel", "**/kernel/**"];

const deepPackagePatterns = [
  "@banijjik/*/src",
  "@banijjik/*/src/**",
  "@banijjik/*/dist",
  "@banijjik/*/dist/**",
];

// Matches every import source EXCEPT @banijjik/contracts, @banijjik/ids and relative paths. The plan
// asked for a negated group, but the `ignore` library behind `group` cannot re-include a child of an
// ignored parent, so "!@banijjik/contracts" never worked (measured); `regex` is the same allow-list.
const DOMAIN_FORBIDDEN_SOURCE = "^(?!@banijjik/(?:contracts|ids)$)(?!\\.{1,2}(?:/|$))";

const DOMAIN_IMPORT_MESSAGE =
  "Domain code imports only @banijjik/contracts, @banijjik/ids and files of its own domain folder (ADR-011a).";

/** Rules that apply to every file of the matching scope. Each entry becomes one config block. */
export const restrictionBlocks = [
  {
    name: "banijjik/id-generators",
    ignores: ID_PACKAGE_FILES,
    rules: {
      "banijjik-guard/no-id-generator-imports": [
        ERROR,
        {
          paths: [
            { name: "uuid", message: RANDOM_UUID_MESSAGE },
            { name: "nanoid", message: RANDOM_UUID_MESSAGE },
            ...["crypto", "node:crypto"].map((name) => ({
              name,
              importNames: ["randomUUID"],
              message: RANDOM_UUID_MESSAGE,
            })),
          ],
          patterns: [{ group: ["uuid/*", "nanoid/*"], message: RANDOM_UUID_MESSAGE }],
        },
      ],
      "banijjik-guard/no-id-generator-dynamic-import": [
        ERROR,
        ...syntaxRules(RANDOM_UUID_MESSAGE, ["ImportExpression[source.value=/^(uuid|nanoid)/]"]),
      ],
      "banijjik-guard/no-random-uuid-call": [
        ERROR,
        { property: "randomUUID", message: RANDOM_UUID_MESSAGE },
      ],
    },
  },
  {
    name: "banijjik/deep-package-imports",
    rules: {
      "banijjik-guard/no-deep-package-imports": [
        ERROR,
        {
          patterns: [
            {
              group: deepPackagePatterns,
              message: "Import a workspace package only through its public entry.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/model-imports",
    ignores: INFRASTRUCTURE_FILES,
    rules: {
      "banijjik-guard/no-model-imports": [
        ERROR,
        {
          patterns: [
            {
              group: ["**/*.model", "**/*.model.js", "**/persistence/**/models/**"],
              message: "Get models through the kernel models(ctx) accessor (ADR-023).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/orm-imports",
    ignores: ORM_ALLOWED_FILES,
    rules: {
      "banijjik-guard/no-orm-imports": [
        ERROR,
        {
          paths: ["mongoose", "mongodb"].map((name) => ({
            name,
            message:
              "Only infrastructure and the kernel talk to the database driver; business code uses models(ctx) (ADR-023).",
          })),
          patterns: [
            {
              group: ["mongoose/*", "mongodb/*"],
              message:
                "Only infrastructure and the kernel talk to the database driver; business code uses models(ctx) (ADR-023).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/domain-purity",
    files: DOMAIN_FILES,
    ignores: TEST_FILES,
    rules: {
      // An allow-list (ADR-011a): every bare specifier and every Node built-in is banned except
      // the two packages. Relative paths stay allowed; the boundaries rule keeps them inside the layer.
      "banijjik-guard/no-domain-framework-imports": [
        ERROR,
        {
          patterns: [
            {
              regex: DOMAIN_FORBIDDEN_SOURCE,
              message: DOMAIN_IMPORT_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/process-env",
    ignores: CONFIG_FILES,
    rules: {
      "banijjik-guard/no-process-env": [
        ERROR,
        {
          object: "process",
          property: "env",
          message: "Read the environment only in the config module (ADR-083).",
        },
      ],
      "banijjik-guard/no-process-env-import": [
        ERROR,
        {
          paths: ["process", "node:process"].map((name) => ({
            name,
            importNames: ["env"],
            message: "Read the environment only in the config module (ADR-083).",
          })),
        },
      ],
      "banijjik-guard/no-process-env-syntax": [ERROR, ...processEnvSyntax],
    },
  },
  {
    name: "banijjik/underscore-id",
    ignores: [...INFRASTRUCTURE_FILES, ...TEST_FILES],
    rules: { "banijjik-guard/no-underscore-id": [ERROR, ...underscoreIdSelectors] },
  },
  {
    name: "banijjik/brand-name",
    files: BRAND_SCOPE_FILES,
    rules: { "banijjik-guard/no-brand-name-literal": [ERROR, ...brandSelectors] },
  },
  {
    name: "banijjik/industry-branching",
    ignores: INDUSTRY_READER_FILES,
    rules: { "banijjik-guard/no-industry-branching": [ERROR, ...industrySelectors] },
  },
  {
    // Later blocks win per rule, so inside core/organization this replaces the list above with the
    // comparison selectors only. The module's infrastructure and tests stay full readers (ignores).
    name: "banijjik/industry-branching-key-owner",
    files: INDUSTRY_KEY_OWNER_FILES,
    ignores: INDUSTRY_READER_FILES,
    rules: { "banijjik-guard/no-industry-branching": [ERROR, ...industryComparisonSelectors] },
  },
  {
    name: "banijjik/run-as-system",
    files: RUN_AS_SYSTEM_FORBIDDEN_FILES,
    ignores: [...RUN_AS_SYSTEM_ALLOWED_FILES, ...TEST_FILES],
    rules: {
      // The call is banned under any name: the import by name (aliases included) and a member call.
      "banijjik-guard/no-run-as-system": [
        ERROR,
        ...syntaxRules(
          "runAsSystem is for the kernel and platform use cases only; module code stays tenant-scoped (05-CONVENTIONS System access).",
          [
            "CallExpression[callee.name='runAsSystem']",
            "CallExpression[callee.property.name='runAsSystem']",
          ],
        ),
      ],
      "banijjik-guard/no-run-as-system-import": [
        ERROR,
        {
          patterns: [
            {
              group: KERNEL_MODULES,
              importNames: ["runAsSystem"],
              message:
                "runAsSystem is for the kernel and platform use cases only; module code stays tenant-scoped (05-CONVENTIONS System access).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/request-context",
    files: MODULE_FILES,
    ignores: TEST_FILES,
    rules: {
      // Building a request context by hand would let module code claim any organization or user.
      "banijjik-guard/no-request-context-import": [
        ERROR,
        {
          patterns: [
            {
              group: KERNEL_MODULES,
              importNames: ["runWithRequestContext", "asSystemPort", "runInOrganizationContext"],
              message:
                "Only the kernel and routes/v1.ts create a request context or grant a bypass; module code reads the context with getRequestContext() and receives a plain port (ADR-087).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/raw-collection",
    files: MODULE_FILES,
    ignores: TEST_FILES,
    rules: {
      // Raw driver collections skip Mongoose middleware, so they would skip the tenant plugin too.
      "banijjik-guard/no-raw-collection": [
        ERROR,
        ...syntaxRules(
          "A raw driver collection bypasses the tenant plugin; use the models(ctx) accessor (ADR-087).",
          [
            "MemberExpression[computed=false][property.name='collection']",
            "MemberExpression[computed=true][property.value='collection']",
            // Change streams have no Mongoose middleware: Model.watch() would stream every organization.
            "CallExpression[callee.property.name='watch']",
          ],
        ),
      ],
    },
  },
  {
    name: "banijjik/public-index-exports",
    files: PUBLIC_INDEX_FILES,
    rules: {
      "banijjik-guard/no-export-star": [
        ERROR,
        {
          selector: "ExportAllDeclaration",
          message: "Export names explicitly from a public index.ts.",
        },
      ],
    },
  },
  {
    name: "banijjik/small-syntax-bans",
    rules: {
      "banijjik-guard/no-then-chain": [
        ERROR,
        ...syntaxRules("Use async/await, not .then() chains.", [
          "CallExpression[callee.property.name='then']",
        ]),
      ],
      "banijjik-guard/no-ssr-false": [
        ERROR,
        ...syntaxRules("App shells must be server-rendered; do not set ssr: false (ADR-010).", [
          "Property[key.name='ssr'][value.value=false]",
        ]),
      ],
      "no-restricted-globals": [
        ERROR,
        ...["localStorage", "sessionStorage"].map((name) => ({
          name,
          message: "Auth uses httpOnly cookies; do not keep tokens or state in web storage.",
        })),
      ],
    },
  },
];
