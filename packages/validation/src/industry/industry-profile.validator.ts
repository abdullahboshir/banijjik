import { z } from "zod";
import { INDUSTRY_BLUEPRINTS, IFieldDefinition } from "@banijjik/contracts";

/**
 * Generates a Zod schema dynamically based on industry blueprint
 */
export function generateIndustryProfileSchema(
  industry: string,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const blueprint = INDUSTRY_BLUEPRINTS[industry];

  if (!blueprint) {
    // Return empty schema for industries without blueprint
    return z.object({});
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {};

  for (const field of blueprint) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case "string":
        fieldSchema = z.string();
        break;
      case "number":
        fieldSchema = z.number();
        break;
      case "date":
        fieldSchema = z.preprocess((arg) => {
          if (typeof arg === "string" || arg instanceof Date) {
            return new Date(arg);
          }
          return arg;
        }, z.date());
        break;
      case "boolean":
        fieldSchema = z.boolean();
        break;
      case "enum":
        if (field.options && field.options.length > 0) {
          fieldSchema = z.enum(field.options as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      default:
        fieldSchema = z.any();
    }

    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    schemaShape[field.key] = fieldSchema;
  }

  return z.object(schemaShape);
}

/**
 * Validates profileAttributes against industry blueprint
 * @returns { valid: boolean, errors?: string[] }
 */
export function validateProfileAttributes(
  industry: string,
  attributes: Record<string, any>,
): { valid: boolean; errors?: string[] } {
  const schema = generateIndustryProfileSchema(industry);
  const result = schema.safeParse(attributes);

  if (result.success) {
    return { valid: true };
  }

  const errors = result.error?.errors.map(
    (e: any) => `${e.path.join(".")}: ${e.message}`,
  );
  return { valid: false, errors };
}

/**
 * Returns the blueprint fields for a given industry
 */
export function getIndustryFields(industry: string): IFieldDefinition[] {
  return INDUSTRY_BLUEPRINTS[industry] || [];
}

/**
 * Gets required fields for an industry
 */
export function getRequiredFields(industry: string): string[] {
  const blueprint = INDUSTRY_BLUEPRINTS[industry];
  if (!blueprint) return [];
  return blueprint.filter((f) => f.required).map((f) => f.key);
}
