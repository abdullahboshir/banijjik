import type { CurrencyCode } from "@banijjik/contracts";
import type {
  ManualDiscount,
  Money,
  PricingRounding,
  PromotionBenefit,
  PromotionTarget,
} from "@banijjik/contracts/pricing";

export interface QuotePromotion {
  readonly promotionId: string;
  readonly status: string;
  readonly priority: number;
  readonly startsAt: Date | undefined;
  readonly endsAt: Date | undefined;
  readonly locationIds: readonly string[];
  readonly target: PromotionTarget;
  readonly benefit: PromotionBenefit;
  readonly minQuantity: number | undefined;
  readonly isStackable: boolean;
  readonly maxDiscountPerLine: Money | undefined;
}

export interface QuoteLineSource {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly kind: string;
  readonly categoryIds: readonly string[];
  readonly unitPriceMinor: number;
  readonly listUnitPriceMinor?: number;
  readonly unitPriceOverrideMinor?: number | null;
  readonly precision: number;
  readonly taxClassKey: string | undefined;
  readonly taxRateBasisPoints: number;
  readonly manualDiscount: ManualDiscount | undefined;
}

export interface QuotePipelineInput {
  readonly currency: CurrencyCode;
  readonly locationId: string;
  readonly at: Date;
  readonly lines: readonly QuoteLineSource[];
  readonly promotions: readonly QuotePromotion[];
  readonly orderDiscount: ManualDiscount | undefined;
  readonly taxInclusive: boolean;
  readonly rounding: PricingRounding;
  readonly paymentIsCash: boolean;
  readonly approvalPercentAbove: number;
  /** 0 means the amount threshold is off. */
  readonly approvalAmountAbove: number;
}

export function moneyOf(amount: number, currency: CurrencyCode): Money {
  return { amount, currency };
}
