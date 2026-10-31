import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { paginationQuerySchema } from "../pagination.js";

export const publicSelectionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("PRODUCT"),
      offeringId: z.string().trim().min(1),
      variantId: z.string().trim().min(1),
      quantity: z.number().int().positive().max(1000),
      modifierOptionIds: z.array(z.string().trim().min(1)).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("SERVICE"),
      offeringId: z.string().trim().min(1),
      variantId: z.string().trim().min(1),
      startsAt: z.string().datetime(),
      resourceIds: z.array(z.string().trim().min(1)).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("RENTAL"),
      offeringId: z.string().trim().min(1),
      variantId: z.string().trim().min(1),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      resourceIds: z.array(z.string().trim().min(1)).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("EVENT"),
      offeringId: z.string().trim().min(1),
      variantId: z.string().trim().min(1),
      eventSessionId: z.string().trim().min(1),
      quantity: z.number().int().positive().max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("PLAN"),
      offeringId: z.string().trim().min(1),
      variantId: z.string().trim().min(1),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      resourceIds: z.array(z.string().trim().min(1)).default([]),
    })
    .strict(),
]);

export const checkoutSelectionSchema = z
  .object({
    selectionId: z.string().trim().min(1),
    selection: publicSelectionSchema,
    customFields: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const checkoutRecipientSnapshotSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    phoneE164: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{1,14}$/),
  })
  .strict();

export const checkoutDeliveryAddressSchema = z
  .object({
    recipientName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(30),
    addressLine: z.string().trim().min(1).max(250),
    districtCode: z.string().trim().min(1).max(50),
    areaCode: z.string().trim().min(1).max(50),
    postalCode: z.string().trim().max(20).optional(),
  })
  .strict();

export const checkoutFulfillmentSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("PICKUP"),
    })
    .strict(),
  z
    .object({
      method: z.enum(["COURIER", "OWN_RIDER"]),
      address: checkoutDeliveryAddressSchema,
    })
    .strict(),
]);

export const placeStorefrontOrderSchema = z
  .object({
    selections: z.array(checkoutSelectionSchema).min(1).max(20),
    recipient: checkoutRecipientSnapshotSchema,
    fulfillment: checkoutFulfillmentSchema,
  })
  .strict();

export const checkoutContactInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{1,14}$/),
    customFields: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const publicQuoteRequestSchema = z
  .object({
    locationId: z.string().trim().min(1),
    selections: z.array(checkoutSelectionSchema).min(1).max(20),
    fulfillment: checkoutFulfillmentSchema,
  })
  .strict()
  .refine((data) => JSON.stringify(data).length <= 65536, {
    message: "Payload too large",
  });

export const submitCheckoutRequestSchema = z
  .object({
    quoteId: z.string().trim().min(1),
    contact: checkoutContactInputSchema,
  })
  .strict()
  .refine((data) => JSON.stringify(data).length <= 65536, {
    message: "Payload too large",
  });

export type PublicSelectionInput = z.infer<typeof publicSelectionSchema>;
export type CheckoutSelectionInput = z.infer<typeof checkoutSelectionSchema>;
export type CheckoutRecipientSnapshotInput = z.infer<typeof checkoutRecipientSnapshotSchema>;
export type CheckoutFulfillmentInput = z.infer<typeof checkoutFulfillmentSchema>;
export type PlaceStorefrontOrderInput = z.infer<typeof placeStorefrontOrderSchema>;
export type CheckoutContactInputSchema = z.infer<typeof checkoutContactInputSchema>;
export type PublicQuoteRequestInput = z.infer<typeof publicQuoteRequestSchema>;
export type SubmitCheckoutRequestInput = z.infer<typeof submitCheckoutRequestSchema>;

export const checkoutIdParamsSchema = z
  .object({
    checkoutId: uuidV7Schema,
  })
  .strict();

export const storefrontRequestListQuerySchema = paginationQuerySchema
  .extend({
    requestType: z.enum(["ORDER", "BOOKING", "ENROLLMENT"]).optional(),
  })
  .strict();

export const storefrontRequestParamsSchema = z
  .object({
    requestType: z.enum(["ORDER", "BOOKING", "ENROLLMENT"]),
    requestId: uuidV7Schema,
  })
  .strict();

export type CheckoutIdParamsInput = z.infer<typeof checkoutIdParamsSchema>;
export type StorefrontRequestListQueryInput = z.infer<typeof storefrontRequestListQuerySchema>;
export type StorefrontRequestParamsInput = z.infer<typeof storefrontRequestParamsSchema>;
