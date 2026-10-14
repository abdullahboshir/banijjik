import type { ZodType } from "zod";

/**
 * STRUCTURED setting values are checked by a schema registered under `schemaKey` (ADR-103).
 * The map starts empty. The card that owns a structured setting adds its schema here.
 */
export const STRUCTURED_SETTING_SCHEMAS: Readonly<Record<string, ZodType>> = Object.freeze({});

export function structuredSettingSchema(schemaKey: string): ZodType | undefined {
  return STRUCTURED_SETTING_SCHEMAS[schemaKey];
}
