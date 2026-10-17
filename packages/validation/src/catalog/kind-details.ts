import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import {
  BILLING_PERIOD_UNIT,
  BOOKING_MODE,
  DEPOSIT_REQUIRED,
  PLAN_START_RULE,
  RENTAL_RATE_UNIT,
  type KindDetails,
  type VariantOverrides,
} from "@banijjik/contracts/catalog";
import { z } from "zod";
import { moneySchema } from "./catalog-parts.js";

const MINUTES_PER_DAY = 1440;
const MIN_SERVICE_MINUTES = 5;
const MAX_ADVANCE_DAYS = 730;
const DEFAULT_ADVANCE_DAYS = 60;
const MAX_RESOURCE_TYPE_KEYS = 10;
const RESOURCE_TYPE_KEY_MAX_LENGTH = 40;
const MAX_PERIOD_COUNT = 120;
const MAX_START_DATES = 60;
const MAX_DIMENSION_CM = 10_000;
const MINUTES_PER_WEEK = 10_080;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const FULL_PERCENT = 100;

const resourceTypeKeysSchema = z
  .array(z.string().trim().min(1).max(RESOURCE_TYPE_KEY_MAX_LENGTH))
  .max(MAX_RESOURCE_TYPE_KEYS)
  .default([]);

const billingPeriodSchema = z.strictObject({
  unit: z.enum(BILLING_PERIOD_UNIT),
  count: z.number().int().min(1).max(MAX_PERIOD_COUNT),
});

const serviceDurationSchema = z.number().int().min(MIN_SERVICE_MINUTES).max(MINUTES_PER_DAY);

/** FIXED asks for minor units, PERCENT for a whole percent; NONE and FULL carry no value. */
const depositRuleSchema = z
  .strictObject({
    required: z.enum(DEPOSIT_REQUIRED),
    value: z.number().int().positive().optional(),
  })
  .refine(
    (rule) => {
      if (rule.required === DEPOSIT_REQUIRED.FIXED) return rule.value !== undefined;
      if (rule.required === DEPOSIT_REQUIRED.PERCENT) {
        return rule.value !== undefined && rule.value <= FULL_PERCENT;
      }
      return rule.value === undefined;
    },
    { path: ["value"] },
  );

const productDetailsSchema = z.strictObject({
  requiresShipping: z.boolean().default(true),
  weightGrams: z.number().int().positive().optional(),
  dimensionsCm: z
    .strictObject({
      l: z.number().positive().max(MAX_DIMENSION_CM),
      w: z.number().positive().max(MAX_DIMENSION_CM),
      h: z.number().positive().max(MAX_DIMENSION_CM),
    })
    .optional(),
});

const serviceDetailsSchema = z.strictObject({
  durationMinutes: serviceDurationSchema,
  bufferAfterMinutes: z.number().int().min(0).max(MINUTES_PER_DAY).default(0),
  requiresResource: z.boolean().default(false),
  resourceTypeKeys: resourceTypeKeysSchema,
  bookingMode: z.enum(BOOKING_MODE).default(BOOKING_MODE.SLOT),
  maxAdvanceDays: z.number().int().min(0).max(MAX_ADVANCE_DAYS).default(DEFAULT_ADVANCE_DAYS),
  depositRule: depositRuleSchema.optional(),
});

const planDetailsSchema = z
  .strictObject({
    billingPeriod: billingPeriodSchema,
    admissionFee: moneySchema.optional(),
    sessionLimitPerPeriod: z.number().int().positive().optional(),
    capacity: z.number().int().positive().optional(),
    startRule: z.enum(PLAN_START_RULE).default(PLAN_START_RULE.ANY_DATE),
    startDates: z.array(z.string().regex(BUSINESS_DATE_PATTERN)).max(MAX_START_DATES).optional(),
    fixedTermPeriods: z.number().int().positive().optional(),
    autoRenewDefault: z.boolean().default(false),
    freezeAllowed: z.boolean().default(false),
    maxFreezeDaysPerYear: z.number().int().positive().optional(),
    securityDeposit: moneySchema.optional(),
  })
  .refine(
    (plan) =>
      plan.startRule === PLAN_START_RULE.FIXED_DATES
        ? plan.startDates !== undefined && plan.startDates.length > 0
        : plan.startDates === undefined,
    { path: ["startDates"] },
  )
  .refine((plan) => plan.freezeAllowed || plan.maxFreezeDaysPerYear === undefined, {
    path: ["maxFreezeDaysPerYear"],
  });

const rentalDetailsSchema = z
  .strictObject({
    rateUnit: z.enum(RENTAL_RATE_UNIT),
    minUnits: z.number().int().positive().default(1),
    maxUnits: z.number().int().positive().optional(),
    resourceTypeKeys: resourceTypeKeysSchema,
    checkInTime: z.string().regex(CLOCK_TIME_PATTERN).optional(),
    checkOutTime: z.string().regex(CLOCK_TIME_PATTERN).optional(),
    depositAmount: moneySchema.optional(),
  })
  .refine((rental) => rental.maxUnits === undefined || rental.maxUnits >= rental.minUnits, {
    path: ["maxUnits"],
  })
  .refine(
    (rental) =>
      rental.rateUnit === RENTAL_RATE_UNIT.NIGHT ||
      (rental.checkInTime === undefined && rental.checkOutTime === undefined),
    { path: ["checkInTime"] },
  );

const eventDetailsSchema = z.strictObject({
  salesCloseMinutesBefore: z.number().int().min(0).max(MINUTES_PER_WEEK).default(0),
  allowWaitlist: z.boolean().default(false),
});

const KIND_DETAILS_SCHEMAS = {
  [OFFERING_KIND.PRODUCT]: productDetailsSchema,
  [OFFERING_KIND.SERVICE]: serviceDetailsSchema,
  [OFFERING_KIND.PLAN]: planDetailsSchema,
  [OFFERING_KIND.RENTAL]: rentalDetailsSchema,
  [OFFERING_KIND.EVENT]: eventDetailsSchema,
} as const;

/** The "variant may override" column of 11 section 2, per kind. RENTAL and EVENT have none. */
const OVERRIDE_SCHEMAS = {
  [OFFERING_KIND.PRODUCT]: z.strictObject({ weightGrams: z.number().int().positive().optional() }),
  [OFFERING_KIND.SERVICE]: z.strictObject({ durationMinutes: serviceDurationSchema.optional() }),
  [OFFERING_KIND.PLAN]: z.strictObject({
    billingPeriod: billingPeriodSchema.optional(),
    sessionLimitPerPeriod: z.number().int().positive().optional(),
  }),
  [OFFERING_KIND.RENTAL]: z.strictObject({}),
  [OFFERING_KIND.EVENT]: z.strictObject({}),
} as const;

export interface ParseIssue {
  /** Path inside the parsed object, for example `["billingPeriod", "count"]`. */
  readonly path: readonly PropertyKey[];
  /** The Zod issue code; the caller maps it to a message key. */
  readonly code: string;
}

export type ParseResult<Value> =
  | { readonly success: true; readonly data: Value }
  | { readonly success: false; readonly issues: readonly ParseIssue[] };

function parseWith<Value>(schema: z.ZodType, value: unknown): ParseResult<Value> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { success: true, data: parsed.data as Value };
  return {
    success: false,
    issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
  };
}

/** Checks `kindDetails` against the schema of the offering's kind. A field of another kind is refused. */
export function parseKindDetails(kind: OfferingKind, value: unknown): ParseResult<KindDetails> {
  return parseWith(KIND_DETAILS_SCHEMAS[kind], value ?? {});
}

/** Checks a variant's overrides: only the fields 11 section 2 lets that kind override. */
export function parseVariantOverrides(
  kind: OfferingKind,
  value: unknown,
): ParseResult<VariantOverrides> {
  return parseWith(OVERRIDE_SCHEMAS[kind], value ?? {});
}
