import type { SettingValueSpec } from "@banijjik/contracts";
import { z, type ZodType } from "zod";
import {
  STRUCTURED_SETTING_SCHEMAS,
  structuredSettingSchema,
} from "./structured-setting-schemas.js";

function boundedInteger(min: number, max: number): ZodType {
  return z.number().int().min(min).max(max);
}

function enumSchema(values: readonly string[]): ZodType {
  const [first, ...rest] = values;
  if (first === undefined) return z.never();
  return z.enum([first, ...rest]);
}

/**
 * The value schema of one setting spec (ADR-013 for MONEY: integer minor units, so a float fails).
 * An unknown STRUCTURED `schemaKey` parses as never: the registry refuses it at startup.
 * Tests pass their own schema map; production uses the empty registry.
 */
export function buildSettingValueSchema(
  spec: SettingValueSpec,
  schemas: Readonly<Record<string, ZodType>> = STRUCTURED_SETTING_SCHEMAS,
): ZodType {
  switch (spec.kind) {
    case "BOOLEAN":
      return z.boolean();
    case "INTEGER":
    case "MONEY":
    case "DURATION_MINUTES":
      return boundedInteger(spec.min, spec.max);
    case "ENUM":
      return enumSchema(spec.values);
    case "TEXT":
      return z.string().max(spec.maxLength);
    case "STRUCTURED":
      return structuredSchema(spec.schemaKey, schemas);
    default: {
      const unreachable: never = spec;
      return unreachable;
    }
  }
}

function structuredSchema(schemaKey: string, schemas: Readonly<Record<string, ZodType>>): ZodType {
  return schemas[schemaKey] ?? structuredSettingSchema(schemaKey) ?? z.never();
}
