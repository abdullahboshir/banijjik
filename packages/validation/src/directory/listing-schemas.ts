import {
  DIRECTORY_CONSENT_KEY_PATTERN,
  DIRECTORY_REASON_KEY_PATTERN,
  DIRECTORY_SAFETY_RULES,
  DIRECTORY_SEARCH_RULES,
  LISTING_REPORT_OUTCOME,
  LISTING_REPORT_STATUS,
  LISTING_REJECTION_NOTE_MAX_LENGTH,
  LISTING_STATUS,
} from "@banijjik/contracts/directory";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

export const listingUpsertRequestSchema = z.strictObject({
  customFields: z.record(z.string(), z.unknown()).optional(),
  photoFileIds: z.array(uuidV7Schema).max(20).optional(),
  version: z.number().int().positive().optional(),
});

export const listingSubmitRequestSchema = z.strictObject({
  /** Empty when the template lists no consents. */
  consents: z
    .array(z.strictObject({ consentKey: z.string().regex(DIRECTORY_CONSENT_KEY_PATTERN) }))
    .default([]),
});

export const listingRejectRequestSchema = z.strictObject({
  reasonKeys: z
    .array(z.string().regex(DIRECTORY_REASON_KEY_PATTERN))
    .min(1)
    .refine((keys) => new Set(keys).size === keys.length),
  note: z.string().trim().min(1).max(LISTING_REJECTION_NOTE_MAX_LENGTH).optional(),
  version: z.number().int().positive(),
});

export const listingTransitionRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

export const listingIdParamsSchema = z.object({
  listingId: uuidV7Schema,
});

export const listingNumberParamsSchema = z.object({
  listingNumber: z.string().trim().min(1).max(40),
});

export const directoryQueueQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      LISTING_STATUS.SUBMITTED,
      LISTING_STATUS.APPROVED,
      LISTING_STATUS.REJECTED,
      LISTING_STATUS.HIDDEN,
    ])
    .optional(),
});

const isoInstantSchema = z.iso.datetime({ offset: true }).or(z.iso.date());

/** Staff all-listings query (card M.3); limit capped at the directory search max (50). */
export const directoryListingsQuerySchema = paginationQuerySchema
  .extend({
    status: z
      .enum([
        LISTING_STATUS.DRAFT,
        LISTING_STATUS.SUBMITTED,
        LISTING_STATUS.APPROVED,
        LISTING_STATUS.REJECTED,
        LISTING_STATUS.HIDDEN,
        LISTING_STATUS.ARCHIVED,
      ])
      .optional(),
    listingNumber: z.string().trim().min(1).max(40).optional(),
    from: isoInstantSchema.pipe(z.coerce.date()).optional(),
    to: isoInstantSchema.pipe(z.coerce.date()).optional(),
    limit: z.coerce.number().int().min(1).max(DIRECTORY_SEARCH_RULES.maxPageLimit).default(20),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to);

/**
 * Public search query. Filter values for custom fields arrive as `f.<fieldKey>` (or
 * `f.<fieldKey>.min` / `.max` for ranges, and `f.<fieldKey>.divisionKey` etc. for GEO_BD).
 * The use case validates keys against the template's filterable fields.
 */
export const listingSearchQuerySchema = paginationQuerySchema
  .extend({
    listingNumber: z.string().trim().min(1).max(40).optional(),
    limit: z.coerce.number().int().min(1).max(DIRECTORY_SEARCH_RULES.maxPageLimit).default(20),
  })
  .passthrough();

/** Customer report body (M.7 decision 3). The reason key is checked against the template in the use case. */
export const listingReportFileRequestSchema = z.strictObject({
  reasonKey: z.string().regex(DIRECTORY_REASON_KEY_PATTERN),
  note: z.string().trim().min(1).max(DIRECTORY_SAFETY_RULES.reportNoteMaxLength).optional(),
});

/** Resolve body (M.7 decision 5): the ids on the staff member's screen, never a bulk "all". */
export const listingReportResolveRequestSchema = z.strictObject({
  reportIds: z
    .array(uuidV7Schema)
    .min(1)
    .max(DIRECTORY_SAFETY_RULES.maxReportIdsPerResolve)
    .refine((ids) => new Set(ids).size === ids.length),
  outcome: z.enum([
    LISTING_REPORT_OUTCOME.DISMISSED,
    LISTING_REPORT_OUTCOME.WARNED,
    LISTING_REPORT_OUTCOME.LISTING_HIDDEN,
    LISTING_REPORT_OUTCOME.ACCOUNT_BLOCKED,
  ]),
  note: z.string().trim().min(1).max(DIRECTORY_SAFETY_RULES.resolutionNoteMaxLength).optional(),
});

/** Queue query (M.7 decision 4): only the open-per-listing queue is served. */
export const directoryReportsQueueQuerySchema = paginationQuerySchema.extend({
  status: z.enum([LISTING_REPORT_STATUS.OPEN]).optional(),
});

/** Reports of one listing, open or resolved (M.7 decision 4). */
export const directoryListingReportsQuerySchema = paginationQuerySchema.extend({
  status: z.enum([LISTING_REPORT_STATUS.OPEN, LISTING_REPORT_STATUS.RESOLVED]).optional(),
});

export const geoBdValueSchema = z
  .strictObject({
    divisionKey: z.string().trim().min(1).max(80),
    districtKey: z.string().trim().min(1).max(80),
    upazilaKey: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (value) => {
      // Validated against the registry in the field-value schema / use case (keeps zod free of the data file).
      return value.divisionKey.length > 0 && value.districtKey.length > 0;
    },
    { message: "validation.invalid_value" },
  );

/** Body of `POST /my/listing-blocks`: listing number to hide from own search (card M.7). */
export const listingBlockCreateRequestSchema = z.strictObject({
  listingNumber: z.string().trim().min(1).max(40),
});
export type ListingBlockCreateBody = z.output<typeof listingBlockCreateRequestSchema>;
