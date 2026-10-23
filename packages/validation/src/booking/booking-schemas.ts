import {
  BOOKING_STATUS,
  CANCEL_FEE_MODE,
  DEPOSIT_REQUIRED,
  LOCAL_TIME_PATTERN,
  MAX_BOOKING_NOTE_LENGTH,
  MAX_CANCEL_REASON_LENGTH,
  MAX_OFFERINGS_PER_RESOURCE,
  MAX_RESOURCE_NAME_LENGTH,
  MAX_SCHEDULE_RANGES_PER_DAY,
  MAX_TIME_OFF_REASON_LENGTH,
  RESOURCE_STATUS,
  WEEKDAYS,
} from "@banijjik/contracts/booking";
import { z } from "zod";
import { contactLinkCreateSchema } from "../custom-field/contact-link-input.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const weekdaySchema = z
  .number()
  .int()
  .refine((value): value is (typeof WEEKDAYS)[number] =>
    (WEEKDAYS as readonly number[]).includes(value),
  );

const localTimeSchema = z.string().regex(LOCAL_TIME_PATTERN);

const scheduleRangeSchema = z
  .strictObject({
    weekday: weekdaySchema,
    opensAt: localTimeSchema,
    closesAt: localTimeSchema,
  })
  .refine((range) => range.opensAt < range.closesAt, { path: ["closesAt"] });

export const resourceCreateRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  resourceTypeKey: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(MAX_RESOURCE_NAME_LENGTH),
  memberId: uuidV7Schema.optional(),
  capacity: z.number().int().min(1).max(10_000).default(1),
  weeklySchedule: z.array(scheduleRangeSchema).max(MAX_SCHEDULE_RANGES_PER_DAY * 7),
  offeringIds: z.array(uuidV7Schema).max(MAX_OFFERINGS_PER_RESOURCE).default([]),
});

export const resourceUpdateRequestSchema = z
  .strictObject({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(MAX_RESOURCE_NAME_LENGTH).optional(),
    memberId: uuidV7Schema.nullable().optional(),
    capacity: z.number().int().min(1).max(10_000).optional(),
    weeklySchedule: z
      .array(scheduleRangeSchema)
      .max(MAX_SCHEDULE_RANGES_PER_DAY * 7)
      .optional(),
    offeringIds: z.array(uuidV7Schema).max(MAX_OFFERINGS_PER_RESOURCE).optional(),
    status: z.enum(RESOURCE_STATUS).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.memberId !== undefined ||
      body.capacity !== undefined ||
      body.weeklySchedule !== undefined ||
      body.offeringIds !== undefined ||
      body.status !== undefined,
  );

export const resourceIdParamsSchema = z.object({
  resourceId: uuidV7Schema,
});

export const resourceListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  status: z.enum(RESOURCE_STATUS).optional(),
  resourceTypeKey: z.string().trim().min(1).max(64).optional(),
});

export const resourceArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

export const resourceTimeOffCreateRequestSchema = z
  .strictObject({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    reason: z.string().trim().min(1).max(MAX_TIME_OFF_REASON_LENGTH).optional(),
  })
  .refine((body) => body.startsAt < body.endsAt, { path: ["endsAt"] });

export const resourceTimeOffIdParamsSchema = z.object({
  resourceId: uuidV7Schema,
  resourceTimeOffId: uuidV7Schema,
});

const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const availabilityQuerySchema = z.strictObject({
  offeringId: uuidV7Schema,
  variantId: uuidV7Schema,
  locationId: uuidV7Schema,
  date: businessDateSchema,
  resourceId: uuidV7Schema.optional(),
});

/** The inline contact follows the 3.1b link-input pattern (ADR-073), so the shapes stay shared. */
export const bookingCreateRequestSchema = z
  .strictObject({
    offeringId: uuidV7Schema,
    variantId: uuidV7Schema,
    locationId: uuidV7Schema,
    startsAt: z.string().datetime(),
    quantity: z.number().int().positive().optional(),
    resourceId: uuidV7Schema.optional(),
    note: z.string().trim().min(1).max(MAX_BOOKING_NOTE_LENGTH).optional(),
    contactId: uuidV7Schema.optional(),
    contact: contactLinkCreateSchema.optional(),
  })
  .superRefine((body, context) => {
    const hasContactId = body.contactId !== undefined;
    const hasContactCreate = body.contact !== undefined;
    if (hasContactId === hasContactCreate) {
      context.addIssue({ code: "custom", path: ["contactId"], message: "contact_required" });
    }
  });

export const bookingHoldRequestSchema = bookingCreateRequestSchema;

export const bookingIdParamsSchema = z.object({
  bookingId: uuidV7Schema,
});

export const bookingListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  date: businessDateSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(BOOKING_STATUS).optional(),
  resourceId: uuidV7Schema.optional(),
  contactId: uuidV7Schema.optional(),
});

export const bookingVersionRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

export const bookingRescheduleRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  startsAt: z.string().datetime(),
  resourceId: uuidV7Schema.optional(),
});

export const bookingCancelRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(MAX_CANCEL_REASON_LENGTH),
});

export const bookingTransitionRequestSchema = bookingVersionRequestSchema;

/** Setting value shapes used when seeding defaults (not request bodies). */
export const bookingDepositRequiredSchema = z.enum(DEPOSIT_REQUIRED);
export const bookingCancelFeeModeSchema = z.enum(CANCEL_FEE_MODE);

export type ResourceCreateBody = z.infer<typeof resourceCreateRequestSchema>;
export type ResourceUpdateBody = z.infer<typeof resourceUpdateRequestSchema>;
export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>;
export type ResourceTimeOffCreateBody = z.infer<typeof resourceTimeOffCreateRequestSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type BookingCreateBody = z.infer<typeof bookingCreateRequestSchema>;
export type BookingHoldBody = z.infer<typeof bookingHoldRequestSchema>;
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;
export type BookingRescheduleBody = z.infer<typeof bookingRescheduleRequestSchema>;
export type BookingCancelBody = z.infer<typeof bookingCancelRequestSchema>;
