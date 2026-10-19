import {
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  PROMOTION_TARGET_SCOPE,
  type Money,
  type PromotionBenefit,
  type PromotionTarget,
} from "@banijjik/contracts/pricing";
import { percentOf, scaleByQuantity } from "./money-math.js";
import type { QuoteLineSource, QuotePromotion } from "./quote-types.js";

function targetMatches(target: PromotionTarget, line: QuoteLineSource): boolean {
  switch (target.scope) {
    case PROMOTION_TARGET_SCOPE.ALL:
      return true;
    case PROMOTION_TARGET_SCOPE.KIND:
      return target.ids.includes(line.kind);
    case PROMOTION_TARGET_SCOPE.CATEGORY:
      return target.ids.some((id) => line.categoryIds.includes(id));
    case PROMOTION_TARGET_SCOPE.OFFERING:
      return target.ids.includes(line.offeringId);
    case PROMOTION_TARGET_SCOPE.VARIANT:
      return target.ids.includes(line.variantId);
    default: {
      const unreachable: never = target.scope;
      return unreachable;
    }
  }
}

function promotionMatches(input: {
  readonly promotion: QuotePromotion;
  readonly line: QuoteLineSource;
  readonly locationId: string;
  readonly at: Date;
}): boolean {
  const { promotion, line, locationId, at } = input;
  if (promotion.status !== PROMOTION_STATUS.ACTIVE) return false;
  if (promotion.startsAt !== undefined && at < promotion.startsAt) return false;
  if (promotion.endsAt !== undefined && at > promotion.endsAt) return false;
  if (promotion.locationIds.length > 0 && !promotion.locationIds.includes(locationId)) {
    return false;
  }
  if (promotion.minQuantity !== undefined && line.quantity < promotion.minQuantity) {
    return false;
  }
  return targetMatches(promotion.target, line);
}

function benefitDiscount(
  benefit: PromotionBenefit,
  line: QuoteLineSource,
  lineGross: number,
): number {
  if (benefit.type === PROMOTION_BENEFIT_TYPE.PERCENT) {
    const basisPoints = typeof benefit.value === "number" ? benefit.value : 0;
    return Math.min(lineGross, percentOf(lineGross, basisPoints));
  }
  if (typeof benefit.value !== "object") return 0;
  const perUnit = benefit.value.amount;
  if (benefit.type === PROMOTION_BENEFIT_TYPE.AMOUNT_OFF) {
    return Math.min(
      lineGross,
      scaleByQuantity({
        amountMinor: perUnit,
        quantity: line.quantity,
        precision: line.precision,
      }),
    );
  }
  // FIXED_PRICE: never raises a price.
  if (perUnit >= line.unitPriceMinor) return 0;
  const atFixed = scaleByQuantity({
    amountMinor: perUnit,
    quantity: line.quantity,
    precision: line.precision,
  });
  return Math.max(0, lineGross - atFixed);
}

function cappedDiscount(
  discount: number,
  maxDiscountPerLine: Money | undefined,
  remaining: number,
): number {
  let value = Math.min(discount, remaining);
  if (maxDiscountPerLine !== undefined) {
    value = Math.min(value, maxDiscountPerLine.amount);
  }
  return Math.max(0, value);
}

interface AppliedPromotion {
  readonly promotionId: string;
  readonly discount: number;
  readonly priority: number;
  readonly isStackable: boolean;
}

function collectCandidates(input: {
  readonly line: QuoteLineSource;
  readonly lineGross: number;
  readonly promotions: readonly QuotePromotion[];
  readonly locationId: string;
  readonly at: Date;
}): AppliedPromotion[] {
  const candidates: AppliedPromotion[] = [];
  for (const promotion of input.promotions) {
    if (!promotionMatches({ promotion, ...input })) continue;
    const raw = benefitDiscount(promotion.benefit, input.line, input.lineGross);
    const discount = cappedDiscount(raw, promotion.maxDiscountPerLine, input.lineGross);
    if (discount <= 0) continue;
    candidates.push({
      promotionId: promotion.promotionId,
      discount,
      priority: promotion.priority,
      isStackable: promotion.isStackable,
    });
  }
  return candidates;
}

function stackDiscounts(
  candidates: readonly AppliedPromotion[],
  lineGross: number,
): { readonly discount: number; readonly promotionIds: readonly string[] } {
  let remaining = lineGross;
  let total = 0;
  const ids: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.isStackable) continue;
    const take = Math.min(candidate.discount, remaining);
    if (take <= 0) continue;
    total += take;
    remaining -= take;
    ids.push(candidate.promotionId);
  }
  return { discount: total, promotionIds: ids };
}

export function applyPromotions(input: {
  readonly line: QuoteLineSource;
  readonly lineGross: number;
  readonly promotions: readonly QuotePromotion[];
  readonly locationId: string;
  readonly at: Date;
}): { readonly discount: number; readonly promotionIds: readonly string[] } {
  const candidates = collectCandidates(input);
  if (candidates.length === 0) return { discount: 0, promotionIds: [] };

  candidates.sort((left, right) => {
    if (right.discount !== left.discount) return right.discount - left.discount;
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.promotionId.localeCompare(right.promotionId);
  });
  const best = candidates[0];
  if (best === undefined) return { discount: 0, promotionIds: [] };

  if (!best.isStackable) {
    return { discount: best.discount, promotionIds: [best.promotionId] };
  }
  return stackDiscounts(candidates, input.lineGross);
}
