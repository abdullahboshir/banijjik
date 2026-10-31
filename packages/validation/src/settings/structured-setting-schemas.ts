import { z, type ZodType } from "zod";
import { creditPaymentMethodsSettingSchema } from "../credit/credit-schemas.js";
import { paymentMethodsSettingSchema } from "../payment/payment-schemas.js";

/**
 * STRUCTURED setting values are checked by a schema registered under `schemaKey` (ADR-103).
 * The map starts empty. The card that owns a structured setting adds its schema here.
 * A test registers its own schema before the registry starts; production does not call that.
 */
const schemas: Record<string, ZodType> = {
  "credit.payment.methods": creditPaymentMethodsSettingSchema,
  "payment.methods": paymentMethodsSettingSchema,
  "website.publicLocationIds": z.array(z.string().min(1)),
};

export const STRUCTURED_SETTING_SCHEMAS: Readonly<Record<string, ZodType>> = schemas;

export function registerStructuredSettingSchema(schemaKey: string, schema: ZodType): void {
  schemas[schemaKey] = schema;
}

export function structuredSettingSchema(schemaKey: string): ZodType | undefined {
  return schemas[schemaKey];
}
