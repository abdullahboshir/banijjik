import {
  DELIVERY_ZONE_STATUS,
  MAX_DELIVERY_FAIL_NOTE_LENGTH,
  SALES_DELIVERY_FAIL_REASON,
} from "@banijjik/contracts/sales/delivery";
import { z } from "zod";
import { versionSchema } from "../organization/organization-fields.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const RECIPIENT_NAME_MAX = 100;
const ADDRESS_LINE_MAX = 250;
const AREA_CODE_MAX = 50;
const POSTAL_CODE_MAX = 20;
const ZONE_KEY_MAX = 50;
const ZONE_NAME_MAX = 160;
const MAX_AREA_CODES = 100;

const areaCodeSchema = z.string().trim().min(1).max(AREA_CODE_MAX);

const localizedNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(ZONE_NAME_MAX),
  en: z.string().trim().min(1).max(ZONE_NAME_MAX),
});

function areaCodesAreUnique(areaCodes: readonly string[]): boolean {
  const folded = areaCodes.map((code) => code.toLowerCase());
  return new Set(folded).size === folded.length;
}

const areaCodesSchema = z
  .array(areaCodeSchema)
  .min(1)
  .max(MAX_AREA_CODES)
  .refine(areaCodesAreUnique);

export const deliveryAddressSchema = z.strictObject({
  recipientName: z.string().trim().min(1).max(RECIPIENT_NAME_MAX),
  phoneE164: phoneE164Schema,
  addressLine: z.string().trim().min(1).max(ADDRESS_LINE_MAX),
  districtCode: z.string().trim().min(1).max(AREA_CODE_MAX),
  areaCode: areaCodeSchema,
  postalCode: z
    .string()
    .trim()
    .max(POSTAL_CODE_MAX)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
});

export const createDeliveryZoneRequestSchema = z.strictObject({
  zoneKey: z.string().trim().min(1).max(ZONE_KEY_MAX),
  name: localizedNameSchema,
  areaCodes: areaCodesSchema,
  feeMinor: z.number().int().min(0).max(MAX_SAFE),
  status: z.enum(DELIVERY_ZONE_STATUS),
});

export const updateDeliveryZoneRequestSchema = z.strictObject({
  version: versionSchema,
  name: localizedNameSchema.optional(),
  areaCodes: areaCodesSchema.optional(),
  feeMinor: z.number().int().min(0).max(MAX_SAFE).optional(),
  status: z.enum(DELIVERY_ZONE_STATUS).optional(),
});

const courierDispatchSchema = z.strictObject({
  method: z.literal("COURIER"),
  consignmentId: uuidV7Schema,
});

const ownRiderDispatchSchema = z.strictObject({
  method: z.literal("OWN_RIDER"),
  deliveryAssignmentId: uuidV7Schema,
});

export const shipOrderRequestSchema = z.strictObject({
  version: versionSchema,
  dispatch: z.discriminatedUnion("method", [courierDispatchSchema, ownRiderDispatchSchema]),
});

const failNoteSchema = z.string().trim().max(MAX_DELIVERY_FAIL_NOTE_LENGTH);

export const deliveryFailedRequestSchema = z
  .strictObject({
    version: versionSchema,
    reasonKey: z.enum(SALES_DELIVERY_FAIL_REASON),
    note: failNoteSchema.optional(),
  })
  .superRefine((body, context) => {
    if (body.reasonKey !== SALES_DELIVERY_FAIL_REASON.OTHER) return;
    if (body.note !== undefined && body.note.length > 0) return;
    context.addIssue({ code: "custom", path: ["note"] });
  });

export type DeliveryAddressBody = z.infer<typeof deliveryAddressSchema>;
export type CreateDeliveryZoneBody = z.infer<typeof createDeliveryZoneRequestSchema>;
export type UpdateDeliveryZoneBody = z.infer<typeof updateDeliveryZoneRequestSchema>;
export type ShipOrderBody = z.infer<typeof shipOrderRequestSchema>;
export type DeliveryFailedBody = z.infer<typeof deliveryFailedRequestSchema>;
