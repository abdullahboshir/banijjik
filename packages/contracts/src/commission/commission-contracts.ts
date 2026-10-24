import { defineEnum } from "../define-enum.js";
import type { Money } from "../accounting/accounting-contracts.js";
import type { OfferingKind } from "../modules/offering-kind.js";

export const COMMISSION_SUBJECT_TYPE = defineEnum(["MEMBER", "ROLE"]);
export type CommissionSubjectType =
  (typeof COMMISSION_SUBJECT_TYPE)[keyof typeof COMMISSION_SUBJECT_TYPE];

export const COMMISSION_TARGET_TYPE = defineEnum(["ALL", "KIND", "CATEGORY", "OFFERING"]);
export type CommissionTargetType =
  (typeof COMMISSION_TARGET_TYPE)[keyof typeof COMMISSION_TARGET_TYPE];

export const COMMISSION_CALCULATION = defineEnum(["PERCENT", "FIXED"]);
export type CommissionCalculation =
  (typeof COMMISSION_CALCULATION)[keyof typeof COMMISSION_CALCULATION];

export const COMMISSION_RULE_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type CommissionRuleStatus =
  (typeof COMMISSION_RULE_STATUS)[keyof typeof COMMISSION_RULE_STATUS];

export const COMMISSION_ENTRY_KIND = defineEnum(["ACCRUAL", "REFUND_ADJUSTMENT"]);
export type CommissionEntryKind =
  (typeof COMMISSION_ENTRY_KIND)[keyof typeof COMMISSION_ENTRY_KIND];

/** `ORDER_LINE` arrives with Part C (order lines with a performer). */
export const COMMISSION_SOURCE_TYPE = defineEnum(["BOOKING"]);
export type CommissionSourceType =
  (typeof COMMISSION_SOURCE_TYPE)[keyof typeof COMMISSION_SOURCE_TYPE];

/** 100 % in basis points: 12.5 % is stored as 1250. */
export const COMMISSION_MAX_BASIS_POINTS = 10_000;

/** The `targetValue` of an `ALL` rule, so the unique slot index has a value for every target. */
export const COMMISSION_ALL_TARGET_VALUE = "*";

export const COMMISSION_API_MESSAGE_KEYS = {
  ruleDuplicate: "errors.commission_rule_duplicate",
  currencyMismatch: "errors.commission_currency_mismatch",
  kindNotEnabled: "errors.commission_kind_not_enabled",
  payoutNothingToPay: "errors.commission_payout_nothing_to_pay",
  payoutTotalChanged: "errors.commission_payout_total_changed",
} as const;

export const COMMISSION_API_MESSAGE_KEY_LIST: readonly string[] = Object.values(
  COMMISSION_API_MESSAGE_KEYS,
);

export interface CommissionRuleResponse {
  readonly commissionRuleId: string;
  readonly subjectType: CommissionSubjectType;
  readonly memberId: string | null;
  readonly roleId: string | null;
  readonly targetType: CommissionTargetType;
  readonly offeringKind: OfferingKind | null;
  readonly categoryId: string | null;
  readonly offeringId: string | null;
  readonly calculation: CommissionCalculation;
  readonly percentBasisPoints: number | null;
  readonly fixedAmount: Money | null;
  readonly status: CommissionRuleStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The rule as it was when an entry used it; editing the rule later never changes an entry. */
export interface CommissionRuleSnapshot {
  readonly commissionRuleId: string;
  readonly subjectType: CommissionSubjectType;
  readonly targetType: CommissionTargetType;
  readonly calculation: CommissionCalculation;
  readonly percentBasisPoints: number | null;
  readonly fixedAmount: Money | null;
}

export interface CommissionEntryResponse {
  readonly commissionEntryId: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly locationId: string;
  readonly sourceType: CommissionSourceType;
  readonly sourceId: string;
  readonly sourceNumber: string | null;
  readonly sequence: number;
  readonly entryKind: CommissionEntryKind;
  readonly amount: Money;
  readonly base: Money;
  readonly sourceGrossTotal: Money;
  readonly ruleSnapshot: CommissionRuleSnapshot;
  readonly businessDate: string;
  readonly payoutId: string | null;
  readonly createdAt: string;
}

export interface CommissionMemberSummaryResponse {
  readonly memberId: string;
  readonly memberName: string;
  readonly open: Money;
  readonly paidTotal: Money;
}

/** The ways a payout can leave the business; each maps to a system asset account (`METHOD_ACCOUNT_CODE`). */
export const COMMISSION_PAYOUT_METHOD = defineEnum(["CASH", "BKASH", "NAGAD", "BANK"]);
export type CommissionPayoutMethod =
  (typeof COMMISSION_PAYOUT_METHOD)[keyof typeof COMMISSION_PAYOUT_METHOD];

/** A mobile wallet payout needs the transaction reference the staff member can check. */
export const COMMISSION_PAYOUT_REFERENCE_METHODS: readonly CommissionPayoutMethod[] = [
  COMMISSION_PAYOUT_METHOD.BKASH,
  COMMISSION_PAYOUT_METHOD.NAGAD,
];

export interface CommissionPayoutPreviewResponse {
  readonly entryCount: number;
  readonly total: Money;
}

export interface CommissionPayoutResponse {
  readonly commissionPayoutId: string;
  readonly payoutNumber: string;
  readonly memberId: string;
  readonly locationId: string;
  readonly upToBusinessDate: string;
  readonly entryCount: number;
  readonly total: Money;
  readonly method: CommissionPayoutMethod;
  readonly externalReference: string | null;
  readonly note: string | null;
  readonly businessDate: string;
  readonly createdAt: string;
}
