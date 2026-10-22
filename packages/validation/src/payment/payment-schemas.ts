import {
  ACCEPTED_PAYMENT_METHODS,
  PAYMENT_DIRECTION,
  PAYMENT_REQUEST_TYPE,
  STORE_CREDIT_DIRECTION,
} from "@banijjik/contracts/payment";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const acceptedMethodValues = ACCEPTED_PAYMENT_METHODS as readonly [string, ...string[]];
const requestTypeValues = Object.values(PAYMENT_REQUEST_TYPE) as [string, ...string[]];
const directionValues = Object.values(PAYMENT_DIRECTION) as [string, ...string[]];
const storeCreditDirectionValues = Object.values(STORE_CREDIT_DIRECTION) as [string, ...string[]];

export const paymentAllocationSchema = z.strictObject({
  requestType: z.enum(requestTypeValues),
  requestId: uuidV7Schema,
  enrollmentPeriodId: uuidV7Schema.optional().nullable(),
  amount: moneySchema,
});

export const receivePaymentRequestSchema = z
  .strictObject({
    locationId: uuidV7Schema,
    method: z.enum(acceptedMethodValues),
    amount: moneySchema,
    externalReference: z.string().trim().min(1).max(100).optional().nullable(),
    allocations: z.array(paymentAllocationSchema).default([]),
    contactId: uuidV7Schema.optional().nullable(),
    businessDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (val) => {
      if (val.method === "BKASH" || val.method === "NAGAD") {
        return Boolean(val.externalReference && val.externalReference.trim().length > 0);
      }
      return true;
    },
    {
      message: "External reference is required for mobile money",
      path: ["externalReference"],
    },
  );

export const refundPaymentRequestSchema = z
  .strictObject({
    locationId: uuidV7Schema,
    method: z.enum(acceptedMethodValues),
    amount: moneySchema,
    externalReference: z.string().trim().min(1).max(100).optional().nullable(),
    allocations: z.array(paymentAllocationSchema).min(1),
    contactId: uuidV7Schema.optional().nullable(),
    businessDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    approvalToken: z.string().trim().min(1).max(500).optional(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (val) => {
      if (val.method === "BKASH" || val.method === "NAGAD") {
        return Boolean(val.externalReference && val.externalReference.trim().length > 0);
      }
      return true;
    },
    {
      message: "External reference is required for mobile money",
      path: ["externalReference"],
    },
  );

export const reversePaymentRequestSchema = z.strictObject({
  approvalToken: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional().nullable(),
});

export const adjustStoreCreditRequestSchema = z.strictObject({
  contactId: uuidV7Schema,
  direction: z.enum(storeCreditDirectionValues),
  amount: moneySchema,
  reason: z.string().trim().min(1).max(200),
  approvalToken: z.string().trim().min(1).max(500),
});

export const paymentIdParamsSchema = z.object({
  paymentId: uuidV7Schema,
});

export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  contactId: uuidV7Schema.optional(),
  method: z.enum(acceptedMethodValues).optional(),
  direction: z.enum(directionValues).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const listDuesQuerySchema = paginationQuerySchema.extend({
  contactId: uuidV7Schema.optional(),
  requestType: z.enum(requestTypeValues).optional(),
  locationId: uuidV7Schema.optional(),
});

export const listStoreCreditEntriesQuerySchema = paginationQuerySchema.extend({
  contactId: uuidV7Schema.optional(),
});

export const paymentMethodsSettingSchema = z.array(z.enum(acceptedMethodValues));
