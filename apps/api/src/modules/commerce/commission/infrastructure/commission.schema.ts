import type { CurrencyCode, OfferingKind } from "@banijjik/contracts";
import {
  COMMISSION_CALCULATION,
  COMMISSION_ENTRY_KIND,
  COMMISSION_RULE_STATUS,
  COMMISSION_SOURCE_TYPE,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
  type CommissionCalculation,
  type CommissionEntryKind,
  type CommissionRuleStatus,
  type CommissionSourceType,
  type CommissionSubjectType,
  type CommissionTargetType,
} from "@banijjik/contracts/commission";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const COMMISSION_RULE_MODEL_NAME = "CommissionRule";
export const COMMISSION_RULE_COLLECTION_NAME = "commission_rules";
export const COMMISSION_ENTRY_MODEL_NAME = "CommissionEntry";
export const COMMISSION_ENTRY_COLLECTION_NAME = "commission_entries";

export interface MoneyDocument {
  amount: number;
  currency: CurrencyCode;
}

export interface CommissionRuleDocument {
  commissionRuleId: string;
  organizationId: string;
  subjectType: CommissionSubjectType;
  memberId: string | null;
  roleId: string | null;
  /** Denormalised copy of the member or role ID, for the unique slot index. */
  subjectId: string;
  targetType: CommissionTargetType;
  offeringKind: OfferingKind | null;
  categoryId: string | null;
  offeringId: string | null;
  /** Denormalised: `"*"` for ALL, otherwise the kind, category ID or offering ID. */
  targetValue: string;
  calculation: CommissionCalculation;
  percentBasisPoints: number | null;
  fixedAmount: MoneyDocument | null;
  status: CommissionRuleStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface CommissionRuleSnapshotDocument {
  commissionRuleId: string;
  subjectType: CommissionSubjectType;
  targetType: CommissionTargetType;
  calculation: CommissionCalculation;
  percentBasisPoints: number | null;
  fixedAmount: MoneyDocument | null;
}

export interface CommissionEntryDocument {
  commissionEntryId: string;
  organizationId: string;
  memberId: string;
  locationId: string;
  sourceType: CommissionSourceType;
  sourceId: string;
  sourceLineId: string | null;
  sourceNumber: string | null;
  sequence: number;
  entryKind: CommissionEntryKind;
  amount: MoneyDocument;
  base: MoneyDocument;
  sourceGrossTotal: MoneyDocument;
  refundedTotalSeen: MoneyDocument;
  ruleSnapshot: CommissionRuleSnapshotDocument;
  businessDate: string;
  payoutId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const moneySchema = new Schema(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const ruleSnapshotSchema = new Schema(
  {
    commissionRuleId: { type: String, required: true },
    subjectType: { type: String, required: true, enum: Object.values(COMMISSION_SUBJECT_TYPE) },
    targetType: { type: String, required: true, enum: Object.values(COMMISSION_TARGET_TYPE) },
    calculation: { type: String, required: true, enum: Object.values(COMMISSION_CALCULATION) },
    percentBasisPoints: { type: Number, default: null },
    fixedAmount: { type: moneySchema, default: null },
  },
  SUB_SCHEMA_OPTIONS,
);

export const commissionRuleSchema = new Schema<CommissionRuleDocument>(
  {
    ...domainIdField("commissionRuleId"),
    organizationId: { type: String, required: true, immutable: true },
    subjectType: { type: String, required: true, enum: Object.values(COMMISSION_SUBJECT_TYPE) },
    memberId: { type: String, default: null },
    roleId: { type: String, default: null },
    subjectId: { type: String, required: true },
    targetType: { type: String, required: true, enum: Object.values(COMMISSION_TARGET_TYPE) },
    offeringKind: { type: String, default: null },
    categoryId: { type: String, default: null },
    offeringId: { type: String, default: null },
    targetValue: { type: String, required: true },
    calculation: { type: String, required: true, enum: Object.values(COMMISSION_CALCULATION) },
    percentBasisPoints: { type: Number, default: null },
    fixedAmount: { type: moneySchema, default: null },
    status: { type: String, required: true, enum: Object.values(COMMISSION_RULE_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

commissionRuleSchema.index({ organizationId: 1, commissionRuleId: 1 }, { unique: true });
// One ACTIVE rule per (subject, target) slot; an archived rule frees the slot.
commissionRuleSchema.index(
  { organizationId: 1, subjectType: 1, subjectId: 1, targetType: 1, targetValue: 1 },
  { unique: true, partialFilterExpression: { status: COMMISSION_RULE_STATUS.ACTIVE } },
);
commissionRuleSchema.index({ organizationId: 1, status: 1, createdAt: -1, commissionRuleId: -1 });

export const commissionEntrySchema = new Schema<CommissionEntryDocument>(
  {
    ...domainIdField("commissionEntryId"),
    organizationId: { type: String, required: true, immutable: true },
    memberId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    sourceType: { type: String, required: true, enum: Object.values(COMMISSION_SOURCE_TYPE) },
    sourceId: { type: String, required: true },
    sourceLineId: { type: String, default: null },
    sourceNumber: { type: String, default: null },
    sequence: { type: Number, required: true },
    entryKind: { type: String, required: true, enum: Object.values(COMMISSION_ENTRY_KIND) },
    amount: { type: moneySchema, required: true },
    base: { type: moneySchema, required: true },
    sourceGrossTotal: { type: moneySchema, required: true },
    refundedTotalSeen: { type: moneySchema, required: true },
    ruleSnapshot: { type: ruleSnapshotSchema, required: true },
    businessDate: { type: String, required: true },
    payoutId: { type: String, default: null },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

commissionEntrySchema.index({ organizationId: 1, commissionEntryId: 1 }, { unique: true });
// Stops a double accrual and a double adjustment: the same sequence cannot be written twice.
commissionEntrySchema.index(
  { organizationId: 1, sourceType: 1, sourceId: 1, sourceLineId: 1, memberId: 1, sequence: 1 },
  { unique: true },
);
commissionEntrySchema.index({
  organizationId: 1,
  memberId: 1,
  businessDate: -1,
  commissionEntryId: -1,
});
commissionEntrySchema.index({
  organizationId: 1,
  locationId: 1,
  memberId: 1,
  payoutId: 1,
  businessDate: 1,
});
