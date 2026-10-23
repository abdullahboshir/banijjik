import {
  COMMISSION_CALCULATION,
  COMMISSION_MAX_BASIS_POINTS,
  COMMISSION_RULE_STATUS,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { OFFERING_KIND } from "@banijjik/contracts";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const isoDateSchema = z.iso.date();

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

const calculationShape = {
  calculation: z.enum(COMMISSION_CALCULATION),
  percentBasisPoints: z.number().int().min(1).max(COMMISSION_MAX_BASIS_POINTS).optional(),
  fixedAmount: moneySchema.optional(),
};

type CalculationInput = {
  readonly calculation: string;
  readonly percentBasisPoints?: number | undefined;
  readonly fixedAmount?: { readonly amount: number } | undefined;
};

interface PresenceCheck {
  readonly field: string;
  readonly isPresent: boolean;
  readonly isExpected: boolean;
}

/** A field that must be there (or must not) for the declared type: "required" or "not_applicable". */
function addPresenceIssues(context: z.RefinementCtx, checks: readonly PresenceCheck[]): void {
  for (const { field, isPresent, isExpected } of checks) {
    if (isPresent === isExpected) continue;
    context.addIssue({
      code: "custom",
      path: [field],
      message: isExpected ? "required" : "not_applicable",
    });
  }
}

/** PERCENT carries basis points only; FIXED carries a positive amount only. */
function addCalculationIssues(value: CalculationInput, context: z.RefinementCtx): void {
  const isPercent = value.calculation === COMMISSION_CALCULATION.PERCENT;
  addPresenceIssues(context, [
    {
      field: "percentBasisPoints",
      isPresent: value.percentBasisPoints !== undefined,
      isExpected: isPercent,
    },
    { field: "fixedAmount", isPresent: value.fixedAmount !== undefined, isExpected: !isPercent },
  ]);
  if (value.fixedAmount !== undefined && value.fixedAmount.amount <= 0) {
    context.addIssue({ code: "custom", path: ["fixedAmount"], message: "amount_positive" });
  }
}

interface SlotInput {
  readonly subjectType: string;
  readonly memberId?: string | undefined;
  readonly roleId?: string | undefined;
  readonly targetType: string;
  readonly offeringKind?: string | undefined;
  readonly categoryId?: string | undefined;
  readonly offeringId?: string | undefined;
}

/** Exactly the one subject field and the one target field that match the declared types. */
function addSlotIssues(value: SlotInput, context: z.RefinementCtx): void {
  const isMember = value.subjectType === COMMISSION_SUBJECT_TYPE.MEMBER;
  const target = value.targetType;
  addPresenceIssues(context, [
    { field: "memberId", isPresent: value.memberId !== undefined, isExpected: isMember },
    { field: "roleId", isPresent: value.roleId !== undefined, isExpected: !isMember },
    {
      field: "offeringKind",
      isPresent: value.offeringKind !== undefined,
      isExpected: target === COMMISSION_TARGET_TYPE.KIND,
    },
    {
      field: "categoryId",
      isPresent: value.categoryId !== undefined,
      isExpected: target === COMMISSION_TARGET_TYPE.CATEGORY,
    },
    {
      field: "offeringId",
      isPresent: value.offeringId !== undefined,
      isExpected: target === COMMISSION_TARGET_TYPE.OFFERING,
    },
  ]);
}

export const commissionRuleCreateRequestSchema = z
  .strictObject({
    subjectType: z.enum(COMMISSION_SUBJECT_TYPE),
    memberId: uuidV7Schema.optional(),
    roleId: uuidV7Schema.optional(),
    targetType: z.enum(COMMISSION_TARGET_TYPE),
    offeringKind: z.enum(OFFERING_KIND).optional(),
    categoryId: uuidV7Schema.optional(),
    offeringId: uuidV7Schema.optional(),
    ...calculationShape,
  })
  .superRefine((value, context) => {
    addSlotIssues(value, context);
    addCalculationIssues(value, context);
  });
export type CommissionRuleCreateBody = z.infer<typeof commissionRuleCreateRequestSchema>;

/** The slot (who and what) never changes: archive the rule and create a new one for another slot. */
export const commissionRuleUpdateRequestSchema = z
  .strictObject({ ...calculationShape, version: z.number().int().positive() })
  .superRefine(addCalculationIssues);
export type CommissionRuleUpdateBody = z.infer<typeof commissionRuleUpdateRequestSchema>;

export const commissionRuleArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});
export type CommissionRuleArchiveBody = z.infer<typeof commissionRuleArchiveRequestSchema>;

/** Not strict: tenant routers merge `organizationId` into params. */
export const commissionRuleIdParamsSchema = z.object({ commissionRuleId: uuidV7Schema });

export const commissionRuleListQuerySchema = z.strictObject({
  subjectType: z.enum(COMMISSION_SUBJECT_TYPE).optional(),
  memberId: uuidV7Schema.optional(),
  roleId: uuidV7Schema.optional(),
  status: z.enum(COMMISSION_RULE_STATUS).optional(),
  ...paginationShape,
});
export type CommissionRuleListQuery = z.infer<typeof commissionRuleListQuerySchema>;

export const commissionEntryListQuerySchema = z.strictObject({
  memberId: uuidV7Schema.optional(),
  location: uuidV7Schema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  ...paginationShape,
});
export type CommissionEntryListQuery = z.infer<typeof commissionEntryListQuerySchema>;

/** `my-entries` has no member filter: the caller's own member is the only one it can see. */
export const commissionMyEntriesQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  ...paginationShape,
});
export type CommissionMyEntriesQuery = z.infer<typeof commissionMyEntriesQuerySchema>;

export const commissionSummaryQuerySchema = z.strictObject({
  location: uuidV7Schema.optional(),
  ...paginationShape,
});
export type CommissionSummaryQuery = z.infer<typeof commissionSummaryQuerySchema>;
