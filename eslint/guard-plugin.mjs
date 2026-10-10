import { builtinRules } from "eslint/use-at-your-own-risk";

/**
 * Local plugin that exposes ESLint's built-in restriction rules under one id per concern.
 *
 * Why: flat config replaces (does not merge) the options of a rule when two blocks configure it.
 * Our restrictions have different path exemptions, so each concern needs its own rule id.
 * These are the stock rules with stock behaviour; no rule logic is written here (ADR-082).
 */
function alias(builtinRuleName) {
  const rule = builtinRules.get(builtinRuleName);
  if (!rule) {
    throw new Error(`ESLint no longer ships the built-in rule "${builtinRuleName}"`);
  }
  return rule;
}

export const guardPlugin = {
  meta: { name: "banijjik-guard" },
  rules: {
    "no-id-generator-imports": alias("no-restricted-imports"),
    "no-random-uuid-call": alias("no-restricted-properties"),
    "no-model-imports": alias("no-restricted-imports"),
    "no-deep-package-imports": alias("no-restricted-imports"),
    "no-domain-framework-imports": alias("no-restricted-imports"),
    "no-process-env": alias("no-restricted-properties"),
    "no-underscore-id": alias("no-restricted-syntax"),
    "no-brand-name-literal": alias("no-restricted-syntax"),
    "no-industry-branching": alias("no-restricted-syntax"),
    "no-export-star": alias("no-restricted-syntax"),
  },
};
