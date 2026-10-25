import { defineEnum } from "../define-enum.js";
import type { CurrencyCode } from "../organization/currency-code.js";
import type { OfferingKind } from "../modules/offering-kind.js";

/** Money in JSON: an integer of minor units plus the currency code (05-CONVENTIONS, ADR-013). */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export const TAX_CLASS_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type TaxClassStatus = (typeof TAX_CLASS_STATUS)[keyof typeof TAX_CLASS_STATUS];

export const PROMOTION_STATUS = defineEnum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type PromotionStatus = (typeof PROMOTION_STATUS)[keyof typeof PROMOTION_STATUS];

export const PROMOTION_TARGET_SCOPE = defineEnum([
  "ALL",
  "KIND",
  "CATEGORY",
  "OFFERING",
  "VARIANT",
]);
export type PromotionTargetScope =
  (typeof PROMOTION_TARGET_SCOPE)[keyof typeof PROMOTION_TARGET_SCOPE];

export const PROMOTION_BENEFIT_TYPE = defineEnum(["PERCENT", "AMOUNT_OFF", "FIXED_PRICE"]);
export type PromotionBenefitType =
  (typeof PROMOTION_BENEFIT_TYPE)[keyof typeof PROMOTION_BENEFIT_TYPE];

export const MANUAL_DISCOUNT_TYPE = defineEnum(["PERCENT", "AMOUNT"]);
export type ManualDiscountType = (typeof MANUAL_DISCOUNT_TYPE)[keyof typeof MANUAL_DISCOUNT_TYPE];

export const PRICING_ROUNDING = defineEnum(["NONE", "NEAREST_1", "NEAREST_5", "NEAREST_10"]);
export type PricingRounding = (typeof PRICING_ROUNDING)[keyof typeof PRICING_ROUNDING];

export function isPricingRounding(value: string): value is PricingRounding {
  return (Object.values(PRICING_ROUNDING) as readonly string[]).includes(value);
}

export const APPROVAL_ACTION = defineEnum(["DISCOUNT"]);
export type ApprovalAction = (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];

export const TAX_CLASS_KEY_MAX_LENGTH = 40;
/** kebab-case, same shape as a tax class key and the default-class setting. */
export const TAX_CLASS_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PRICING_TAX_INCLUSIVE_SETTING_KEY = "pricing.taxInclusive";
export const PRICING_ROUNDING_SETTING_KEY = "pricing.rounding";
export const PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY =
  "pricing.approval.discountPercentAbove";
export const PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY =
  "pricing.approval.discountAmountAbove";
export const PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY = "pricing.defaultTaxClassKey";

/** Basis points: 1000 = 10%. */
export const DEFAULT_APPROVAL_DISCOUNT_PERCENT_ABOVE = 1000;
/** 0 means the amount threshold is off (only the percent threshold applies). */
export const DEFAULT_APPROVAL_DISCOUNT_AMOUNT_ABOVE = 0;

export const MAX_PROMOTION_NAME_LENGTH = 160;
export const MAX_QUOTE_LINES = 100;
export const MAX_MODIFIER_OPTIONS_PER_LINE = 30;

export interface PromotionTarget {
  readonly scope: PromotionTargetScope;
  readonly ids: readonly string[];
}

/**
 * PERCENT value is basis points (750 = 7.5%). AMOUNT_OFF and FIXED_PRICE are Money per sales unit.
 */
export interface PromotionBenefit {
  readonly type: PromotionBenefitType;
  readonly value: number | Money;
}

export interface TaxClassResponse {
  readonly taxClassId: string;
  readonly taxClassKey: string;
  readonly name: string;
  readonly rateBasisPoints: number;
  readonly status: TaxClassStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PromotionResponse {
  readonly promotionId: string;
  readonly name: string;
  readonly status: PromotionStatus;
  readonly priority: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly locationIds: readonly string[];
  readonly target: PromotionTarget;
  readonly benefit: PromotionBenefit;
  readonly minQuantity: number | null;
  readonly isStackable: boolean;
  readonly maxDiscountPerLine: Money | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ManualDiscount {
  readonly type: ManualDiscountType;
  /** PERCENT: basis points. AMOUNT: minor units on the line. */
  readonly value: number;
}

export interface QuoteLineInput {
  readonly offeringId: string;
  readonly variantId: string;
  /** Integer in the sales unit's precision (ADR-047). */
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
  readonly manualDiscount?: ManualDiscount;
  /** Optional POS price override per sales unit (card 3.9 A2-2). */
  readonly unitPriceOverride?: Money;
}

export interface QuoteRequest {
  readonly locationId: string;
  readonly at?: string;
  readonly lines: readonly QuoteLineInput[];
  readonly orderDiscount?: ManualDiscount;
  readonly paymentIsCash?: boolean;
  /** Reserved for card 3.5; ignored by this card. */
  readonly deliveryCharge?: Money;
}

export interface QuoteLineResult {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  /** The catalog unit price before a POS override (card 3.9 A2-2). */
  readonly listUnitPrice: Money;
  /** The POS unit price override when one was applied, or null (card 3.9 A2-2). */
  readonly unitPriceOverride: Money | null;
  readonly lineGross: Money;
  readonly promotionDiscount: Money;
  readonly manualDiscount: Money;
  readonly lineDiscount: Money;
  readonly lineTax: Money;
  readonly lineNetTotal: Money;
  readonly promotionIds: readonly string[];
  readonly taxClassKey: string | null;
  readonly taxRateBasisPoints: number;
}

export interface QuoteTotals {
  readonly subtotal: Money;
  readonly discountTotal: Money;
  readonly taxTotal: Money;
  readonly grandTotal: Money;
  readonly roundingAdjustment: Money;
}

export interface ApprovalRequired {
  readonly action: ApprovalAction;
  readonly lineIndex?: number;
}

export interface QuoteResponse {
  readonly lines: readonly QuoteLineResult[];
  readonly totals: QuoteTotals;
  readonly approvalsRequired: readonly ApprovalRequired[];
}

export interface PromotionEventPayload {
  readonly promotionId: string;
}

/** Target scope KIND stores offering kind values in `ids`. */
export type PromotionTargetKindId = OfferingKind;
