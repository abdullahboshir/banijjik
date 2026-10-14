import { NEVER, z, type ZodType } from "zod";
import { fieldValueSchema } from "./field-value-schema.js";
import {
  CUSTOM_FIELD_VALUE_MODE,
  isVisibleTo,
  type CustomFieldRule,
  type CustomFieldValuesOptions,
} from "./custom-field-rule.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A strict object of the fields visible to the audience. An unknown key, or a key hidden from
 * that audience, fails at that key so the path is `customFields.<key>` when the object is nested.
 */
export function buildCustomFieldValuesSchema(
  fields: readonly CustomFieldRule[],
  options: CustomFieldValuesOptions,
): ZodType {
  const visible = fields.filter((field) => isVisibleTo(field, options.audience));
  const shape: Record<string, ZodType> = {};
  for (const field of visible) {
    shape[field.fieldKey] = fieldValueSchema(field, options.mode);
  }
  const known = z.object(shape);
  return z.unknown().transform((input, context) => {
    if (!isRecord(input)) {
      context.addIssue({ code: "invalid_type", expected: "object", path: [], input });
      return NEVER;
    }
    const unknownKeys = Object.keys(input).filter((key) => !(key in shape));
    for (const key of unknownKeys) {
      context.addIssue({ code: "unrecognized_keys", keys: [key], path: [key], input });
    }
    if (unknownKeys.length > 0) return NEVER;
    const parsed = known.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        // Safe: the issue was produced by Zod for this value. addIssue's parameter type
        // requires an index signature that Zod's own issue objects do not declare.
        context.addIssue(issue as never);
      }
      return NEVER;
    }
    return parsed.data;
  });
}

export { CUSTOM_FIELD_VALUE_MODE };
