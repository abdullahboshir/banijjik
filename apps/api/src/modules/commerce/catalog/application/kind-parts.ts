import {
  VALIDATION_FALLBACK_MESSAGE_KEY,
  VALIDATION_MESSAGE_KEYS,
  type OfferingKind,
} from "@banijjik/contracts";
import type { KindDetails } from "@banijjik/contracts/catalog";
import {
  parseKindDetails,
  parseVariantOverrides,
  type ParseIssue,
  type VariantInput,
} from "@banijjik/validation";
import { invalidFields, type FieldProblem } from "../domain/errors.js";
import type { VariantDraft } from "../domain/variant-merge.js";

function messageKeyOf(code: string): string {
  const messageKey = `validation.${code}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

function toProblems(prefix: string, issues: readonly ParseIssue[]): FieldProblem[] {
  return issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].join("."),
    messageKey: messageKeyOf(issue.code),
  }));
}

/**
 * `kindDetails` checked against the offering's kind (11 section 2), defaults applied. A field of
 * another kind is a 400 at `kindDetails.<field>`. Used on update, where the kind is the stored one.
 */
export function resolveKindDetails(kind: OfferingKind, raw: unknown): KindDetails {
  const parsed = parseKindDetails(kind, raw);
  if (!parsed.success) throw invalidFields(toProblems("kindDetails", parsed.issues));
  return parsed.data;
}

/**
 * The variants as drafts for `mergeVariants`: each `overrides` object is checked against the kind,
 * so only the fields 11 section 2 lets that kind override get through (400 at `variants.<n>.overrides`).
 */
export function resolveVariantDrafts(
  kind: OfferingKind,
  inputs: readonly VariantInput[],
): VariantDraft[] {
  const problems: FieldProblem[] = [];
  const drafts = inputs.map((input, index) => {
    const overrides = parseVariantOverrides(kind, input.overrides);
    if (!overrides.success) {
      problems.push(...toProblems(`variants.${index}.overrides`, overrides.issues));
      return { ...input, overrides: {} };
    }
    return { ...input, overrides: overrides.data };
  });
  if (problems.length > 0) throw invalidFields(problems);
  return drafts;
}
