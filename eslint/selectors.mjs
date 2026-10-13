// Selector lists for the no-restricted-syntax based rules (R13 to R16, R26 to R30, R36).
const IMPORT_SOURCE_PARENTS =
  "ImportDeclaration, ImportExpression, ExportAllDeclaration, ExportNamedDeclaration, TSImportType, TSLiteralType";
const COMPARISON = "BinaryExpression[operator=/^[!=]==?$/]";
const INDUSTRY_NAME = "/^industry/";
const COMPUTED_MEMBER = "MemberExpression[computed=true]";
const INCLUDES_CALL = "CallExpression[callee.property.name='includes']";
/** One no-restricted-syntax entry per selector, all sharing a message. */
export function syntaxRules(message, selectors) {
  return selectors.map((selector) => ({ selector, message }));
}

const INDUSTRY_MESSAGE =
  "Feature code must not branch on industry; ask resolveOrgConfig instead (ADR-033).";

/**
 * Comparisons, switches, list lookups and computed keys on an industry value. The module that owns
 * the key (core/organization, 09 section 4.2) is held to these only, because it must carry the
 * field through its layers (ADR-082).
 */
export const industryComparisonSelectors = syntaxRules(INDUSTRY_MESSAGE, [
  `${COMPARISON} > MemberExpression[property.name=${INDUSTRY_NAME}]`,
  `${COMPARISON} > Identifier[name=${INDUSTRY_NAME}]`,
  `SwitchStatement > MemberExpression.discriminant[property.name=${INDUSTRY_NAME}]`,
  `SwitchStatement > Identifier.discriminant[name=${INDUSTRY_NAME}]`,
  // A computed key such as organization["industryTemplateKey"] or TABLE[organization.industry].
  `${COMPUTED_MEMBER} > Literal.property[value='industryTemplateKey']`,
  `${COMPUTED_MEMBER} > MemberExpression.property[property.name=${INDUSTRY_NAME}]`,
  `${COMPUTED_MEMBER} > Identifier.property[name=${INDUSTRY_NAME}]`,
  // A list lookup such as ["a", "b"].includes(organization.industry).
  `${INCLUDES_CALL} > MemberExpression[property.name=${INDUSTRY_NAME}]`,
  `${INCLUDES_CALL} > Identifier[name=${INDUSTRY_NAME}]`,
]);

/** Everywhere else even the bare identifier `industryTemplateKey` is reported. */
export const industrySelectors = [
  ...syntaxRules(INDUSTRY_MESSAGE, ["Identifier[name='industryTemplateKey']"]),
  ...industryComparisonSelectors,
];

export const brandSelectors = syntaxRules(
  "Do not hard-code the brand name in UI strings; read it from branding config (ADR-038).",
  [
    `Literal[value=/banijjik/i]:not(:matches(${IMPORT_SOURCE_PARENTS}) > Literal)`,
    "TemplateElement[value.raw=/banijjik/i]",
    "JSXText[value=/banijjik/i]",
  ],
);

export const underscoreIdSelectors = syntaxRules(
  "Mongo _id is infrastructure-only; use the domain ID (ADR-036).",
  [
    "Identifier[name='_id']",
    // "_id" and "$_id" (an aggregation field path) as plain strings or inside a template literal.
    "Literal[value=/^\\$?_id$/]",
    "TemplateElement[value.raw=/\\b_id\\b/]",
  ],
);

export const processEnvSyntax = syntaxRules(
  "Read the environment only in the config module (ADR-083).",
  [
    "MemberExpression[object.object.name='globalThis'][object.property.name='process'][property.name='env']",
  ],
);

/** R37: a JSX text node that contains a letter is user-facing copy, which belongs in an i18n catalog. */
export const jsxTextSelectors = syntaxRules(
  "User-facing text belongs in an i18n catalog, not in JSX.",
  ["JSXText[value=/[A-Za-z\\u0980-\\u09FF]/]"],
);

/** R38: a property named exactly `id` on an object type or an interface (ADR-036). */
export const bareIdSelectors = syntaxRules("Name the entity: userId, not id (ADR-036).", [
  "TSPropertySignature[key.name='id']",
  "TSPropertySignature[key.value='id']",
]);

const MIDDLEWARE_OPTION_NAMES = "/^(middleware|skipMiddlewareFunction)$/";

/** R36: every spelling of the Mongoose option that skips hooks: an object key, an assignment or a setOptions argument. */
export const middlewareBypassSelectors = [
  `Property[key.name=${MIDDLEWARE_OPTION_NAMES}]`,
  `Property[key.value=${MIDDLEWARE_OPTION_NAMES}]`,
  `MemberExpression[property.name=${MIDDLEWARE_OPTION_NAMES}]`,
  `MemberExpression[computed=true][property.value=${MIDDLEWARE_OPTION_NAMES}]`,
  "CallExpression[callee.property.name='setOptions'] Identifier[name='middleware']",
];
