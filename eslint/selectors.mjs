// Selector lists for the no-restricted-syntax based rules (R13 to R16, R26 to R30).
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

export const industrySelectors = syntaxRules(
  "Feature code must not branch on industry; ask resolveOrgConfig instead (ADR-033).",
  [
    "Identifier[name='industryTemplateKey']",
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
  ],
);

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
