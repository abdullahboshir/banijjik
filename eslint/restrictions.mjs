import {
  BRAND_SCOPE_FILES,
  CONFIG_FILES,
  DOMAIN_FILES,
  ID_PACKAGE_FILES,
  INDUSTRY_KEY_OWNER_FILES,
  INDUSTRY_READER_FILES,
  INFRASTRUCTURE_FILES,
  ORM_ALLOWED_FILES,
  PUBLIC_INDEX_FILES,
  TEST_FILES,
} from "./scopes.mjs";

import {
  bareIdSelectors,
  brandSelectors,
  industryComparisonSelectors,
  industrySelectors,
  jsxTextSelectors,
  processEnvSyntax,
  syntaxRules,
  underscoreIdSelectors,
} from "./selectors.mjs";

const ERROR = "error";
const RANDOM_UUID_MESSAGE =
  "Use newId() from @banijjik/ids; it is the only ID generator (ADR-036).";

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
  {
    name: "banijjik/jsx-text",
    // A new app must be added to `files`, or its JSX text is not checked.
    files: ["apps/admin/**/*.{tsx,jsx}", "apps/platform/**/*.{tsx,jsx}"],
    ignores: TEST_FILES,
    rules: { "banijjik-guard/no-jsx-text": [ERROR, ...jsxTextSelectors] },
  },
  {
    name: "banijjik/bare-id",
    files: ["**/domain/**", "packages/contracts/**"],
    ignores: TEST_FILES,
    rules: { "banijjik-guard/no-bare-id": [ERROR, ...bareIdSelectors] },
  },
];
