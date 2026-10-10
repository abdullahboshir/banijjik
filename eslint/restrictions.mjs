import { builtinModules } from "node:module";
import {
  BRAND_SCOPE_FILES,
  CONFIG_FILES,
  DOMAIN_FILES,
  ID_PACKAGE_FILES,
  INDUSTRY_READER_FILES,
  INFRASTRUCTURE_FILES,
  PUBLIC_INDEX_FILES,
  TEST_FILES,
} from "./scopes.mjs";

const ERROR = "error";
const RANDOM_UUID_MESSAGE =
  "Use newId() from @banijjik/ids; it is the only ID generator (ADR-036).";
const IMPORT_SOURCE_PARENTS =
  "ImportDeclaration, ImportExpression, ExportAllDeclaration, ExportNamedDeclaration, TSImportType, TSLiteralType";
const COMPARISON = "BinaryExpression[operator=/^[!=]==?$/]";
const INDUSTRY_NAME = "/^industry/";

const nodeBuiltinModules = builtinModules.flatMap((name) => [name, `node:${name}`]);

const industrySelectors = [
  "Identifier[name='industryTemplateKey']",
  `${COMPARISON} > MemberExpression[property.name=${INDUSTRY_NAME}]`,
  `${COMPARISON} > Identifier[name=${INDUSTRY_NAME}]`,
  `SwitchStatement > MemberExpression.discriminant[property.name=${INDUSTRY_NAME}]`,
  `SwitchStatement > Identifier.discriminant[name=${INDUSTRY_NAME}]`,
].map((selector) => ({
  selector,
  message: "Feature code must not branch on industry; ask resolveOrgConfig instead (ADR-033).",
}));

const brandSelectors = [
  `Literal[value=/banijjik/i]:not(:matches(${IMPORT_SOURCE_PARENTS}) > Literal)`,
  "TemplateElement[value.raw=/banijjik/i]",
].map((selector) => ({
  selector,
  message: "Do not hard-code the brand name in UI strings; read it from branding config (ADR-038).",
}));

const deepPackagePatterns = [
  "@banijjik/*/src",
  "@banijjik/*/src/**",
  "@banijjik/*/dist",
  "@banijjik/*/dist/**",
];

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
    name: "banijjik/domain-purity",
    files: DOMAIN_FILES,
    rules: {
      "banijjik-guard/no-domain-framework-imports": [
        ERROR,
        {
          paths: [
            "express",
            "mongoose",
            "zod",
            "ioredis",
            "bullmq",
            "pino",
            "@banijjik/validation",
            ...nodeBuiltinModules,
          ].map((name) => ({
            name,
            message: "Domain code imports only @banijjik/contracts and @banijjik/ids (ADR-011a).",
          })),
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
    },
  },
  {
    name: "banijjik/underscore-id",
    ignores: [...INFRASTRUCTURE_FILES, ...TEST_FILES],
    rules: {
      "banijjik-guard/no-underscore-id": [
        ERROR,
        ...["Identifier[name='_id']", "Literal[value='_id']"].map((selector) => ({
          selector,
          message: "Mongo _id is infrastructure-only; use the domain ID (ADR-036).",
        })),
      ],
    },
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
];
