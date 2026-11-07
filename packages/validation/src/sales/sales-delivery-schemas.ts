import {
  DELIVERY_ZONE_STATUS,
  MAX_DELIVERY_FAIL_NOTE_LENGTH,
  SALES_DELIVERY_FAIL_REASON,
} from "@banijjik/contracts/sales/delivery";
import { z } from "zod";
import { versionSchema } from "../organization/organization-fields.js";
import { MAX_PAGE_SIZE, paginationQuerySchema } from "../pagination.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const DEFAULT_ZONE_PAGE_SIZE = 50;
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

export const deliveryZoneListQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_ZONE_PAGE_SIZE),
});

/** Not strict: the tenant mount also puts `organizationId` on `req.params`. */
export const deliveryZoneIdParamsSchema = z.object({
  deliveryZoneId: uuidV7Schema,
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

export const receiveRtsRequestSchema = z.strictObject({
  version: versionSchema,
  reasonKey: z.string().trim().max(100).optional(),
  restockDisposition: z.enum(["RESTOCK", "RETURN_DAMAGED"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export const deliverOrderRequestSchema = z.strictObject({
  version: versionSchema,
  note: z.string().trim().max(500).optional(),
});

export const deliveryLossLineInputSchema = z.strictObject({
  orderLineId: uuidV7Schema,
  restockQuantity: z.number().int().min(0).max(MAX_SAFE),
  damagedQuantity: z.number().int().min(0).max(MAX_SAFE),
  lostQuantity: z.number().int().min(0).max(MAX_SAFE),
});

export const reconcileDeliveryLossRequestSchema = z
  .strictObject({
    expectedVersion: versionSchema,
    reasonKey: z.string().trim().min(1).max(100),
    approvalToken: z.string().trim().min(1),
    evidenceFileIds: z.array(uuidV7Schema).max(10).optional(),
    lines: z.array(deliveryLossLineInputSchema).min(1).max(100),
  })
  .superRefine((body, context) => {
    const totalLost = body.lines.reduce((sum, line) => sum + line.lostQuantity, 0);
    if (totalLost <= 0) {
      context.addIssue({
        code: "custom",
        message: "at least one unit must be lost to close loss",
        path: ["lines"],
      });
    }
  });

export const recoverDeliveryLossLineInputSchema = z.strictObject({
  orderLineId: uuidV7Schema,
  restockQuantity: z.number().int().min(0).max(MAX_SAFE),
  damagedQuantity: z.number().int().min(0).max(MAX_SAFE),
});

export const recoverDeliveryLossRequestSchema = z
  .strictObject({
    expectedVersion: versionSchema,
    approvalToken: z.string().trim().min(1),
    lines: z.array(recoverDeliveryLossLineInputSchema).min(1).max(100),
  })
  .superRefine((body, context) => {
    const totalRecovered = body.lines.reduce(
      (sum, line) => sum + line.restockQuantity + line.damagedQuantity,
      0,
    );
    if (totalRecovered <= 0) {
      context.addIssue({
        code: "custom",
        message: "at least one unit must be recovered",
        path: ["lines"],
      });
    }
  });

export type DeliveryAddressBody = z.infer<typeof deliveryAddressSchema>;
export type CreateDeliveryZoneBody = z.infer<typeof createDeliveryZoneRequestSchema>;
export type UpdateDeliveryZoneBody = z.infer<typeof updateDeliveryZoneRequestSchema>;
export type DeliveryZoneListQuery = z.infer<typeof deliveryZoneListQuerySchema>;
export type DeliveryZoneIdParams = z.infer<typeof deliveryZoneIdParamsSchema>;
export type ShipOrderBody = z.infer<typeof shipOrderRequestSchema>;
export type DeliveryFailedBody = z.infer<typeof deliveryFailedRequestSchema>;
export type ReceiveRtsBody = z.infer<typeof receiveRtsRequestSchema>;
export type DeliverOrderBody = z.infer<typeof deliverOrderRequestSchema>;
export type ReconcileDeliveryLossBody = z.infer<typeof reconcileDeliveryLossRequestSchema>;
export type RecoverDeliveryLossBody = z.infer<typeof recoverDeliveryLossRequestSchema>;
