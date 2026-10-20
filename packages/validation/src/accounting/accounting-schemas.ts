import {
  ACCOUNT_STATUS,
  ACCOUNT_TYPE,
  EXPENSE_PAID_VIA,
  JOURNAL_SOURCE_TYPE,
} from "@banijjik/contracts/accounting";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "businessDate");

const localizedNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(120),
  en: z.string().trim().min(1).max(120),
});

export const trialBalanceQuerySchema = z.strictObject({
  asOf: isoDateSchema,
});
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;

export const journalListQuerySchema = z.strictObject({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  sourceType: z.enum(JOURNAL_SOURCE_TYPE).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type JournalListQuery = z.infer<typeof journalListQuerySchema>;

export const expenseListQuerySchema = z.strictObject({
  locationId: uuidV7Schema.optional(),
  expenseCategoryId: uuidV7Schema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

/** Not strict: tenant routers merge `organizationId` into params (same as offeringIdParamsSchema). */
export const expenseIdParamsSchema = z.object({
  expenseId: uuidV7Schema,
});

export const expenseCategoryIdParamsSchema = z.object({
  expenseCategoryId: uuidV7Schema,
});

export const expenseCreateRequestSchema = z.strictObject({
  expenseCategoryId: uuidV7Schema,
  amount: moneySchema.refine((value) => value.amount > 0, { message: "amount_positive" }),
  paidVia: z.enum(EXPENSE_PAID_VIA),
  businessDate: isoDateSchema,
  locationId: uuidV7Schema,
  note: z.string().trim().max(1000).optional(),
  attachmentFileIds: z.array(uuidV7Schema).max(5).default([]),
  customFields: z.record(z.string(), z.unknown()).optional(),
});
export type ExpenseCreateBody = z.infer<typeof expenseCreateRequestSchema>;

export const expenseVoidRequestSchema = z.strictObject({
  reason: z.string().trim().min(1).max(500),
  version: z.number().int().positive(),
});
export type ExpenseVoidBody = z.infer<typeof expenseVoidRequestSchema>;

export const expenseCategoryCreateRequestSchema = z.strictObject({
  name: localizedNameSchema,
});
export type ExpenseCategoryCreateBody = z.infer<typeof expenseCategoryCreateRequestSchema>;

export const expenseCategoryUpdateRequestSchema = z.strictObject({
  name: localizedNameSchema,
  version: z.number().int().positive().optional(),
});
export type ExpenseCategoryUpdateBody = z.infer<typeof expenseCategoryUpdateRequestSchema>;

export const expenseCategoryArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive().optional(),
});
export type ExpenseCategoryArchiveBody = z.infer<typeof expenseCategoryArchiveRequestSchema>;

const localizedNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(120),
  en: z.string().trim().min(1).max(120),
});

export const accountCreateRequestSchema = z.strictObject({
  name: localizedNameSchema,
  accountType: z.enum(ACCOUNT_TYPE),
  parentAccountCode: z.string().trim().max(50).optional(),
});
export type AccountCreateBody = z.infer<typeof accountCreateRequestSchema>;

export const accountUpdateRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  name: localizedNameSchema.optional(),
  status: z.enum(ACCOUNT_STATUS).optional(),
});
export type AccountUpdateBody = z.infer<typeof accountUpdateRequestSchema>;

const manualJournalLineSchema = z
  .strictObject({
    accountId: uuidV7Schema,
    debit: moneySchema.optional(),
    credit: moneySchema.optional(),
  })
  .refine(
    (line) =>
      (line.debit !== undefined && line.credit === undefined) ||
      (line.credit !== undefined && line.debit === undefined),
    { message: "one_side_only" },
  );

export const manualJournalEntryRequestSchema = z.strictObject({
  businessDate: isoDateSchema,
  locationId: uuidV7Schema.optional(),
  memo: z.string().trim().min(1).max(500),
  lines: z.array(manualJournalLineSchema).min(2).max(20),
});
export type ManualJournalEntryBody = z.infer<typeof manualJournalEntryRequestSchema>;

export const profitAndLossQuerySchema = z.strictObject({
  from: isoDateSchema,
  to: isoDateSchema,
  locationId: uuidV7Schema.optional(),
});
export type ProfitAndLossQuery = z.infer<typeof profitAndLossQuerySchema>;

export const balanceSheetQuerySchema = z.strictObject({
  asOf: isoDateSchema,
});
export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;

export const reverseEntryRequestSchema = z.strictObject({
  businessDate: isoDateSchema,
});
export type ReverseEntryBody = z.infer<typeof reverseEntryRequestSchema>;
