import {
  MANUAL_DISCOUNT_TYPE,
  type ApprovalRequired,
  type ManualDiscount,
} from "@banijjik/contracts/pricing";
import { percentOf } from "./money-math.js";

export function manualAmount(discount: ManualDiscount | undefined, baseMinor: number): number {
  if (discount === undefined) return 0;
  if (discount.type === MANUAL_DISCOUNT_TYPE.PERCENT) {
    return Math.min(baseMinor, percentOf(baseMinor, discount.value));
  }
  return Math.min(baseMinor, discount.value);
}

function discountApproval(input: {
  readonly amount: number;
  readonly baseMinor: number;
  readonly thresholds: { readonly percentAbove: number; readonly amountAbove: number };
  readonly lineIndex: number | undefined;
}): ApprovalRequired[] {
  if (input.amount <= 0) return [];
  const percentBasisPoints =
    input.baseMinor > 0 ? Math.floor((input.amount * 10_000) / input.baseMinor) : 0;
  const overPercent = percentBasisPoints > input.thresholds.percentAbove;
  const overAmount =
    input.thresholds.amountAbove > 0 && input.amount > input.thresholds.amountAbove;
  if (!overPercent && !overAmount) return [];
  return input.lineIndex === undefined
    ? [{ action: "DISCOUNT" }]
    : [{ action: "DISCOUNT", lineIndex: input.lineIndex }];
}

export function approvalsFor(input: {
  readonly lineIndex: number;
  readonly discount: ManualDiscount | undefined;
  readonly lineGross: number;
  readonly thresholds: { readonly percentAbove: number; readonly amountAbove: number };
}): ApprovalRequired[] {
  return discountApproval({
    amount: manualAmount(input.discount, input.lineGross),
    baseMinor: input.lineGross,
    thresholds: input.thresholds,
    lineIndex: input.lineIndex,
  });
}

export function orderApprovals(input: {
  readonly discount: ManualDiscount | undefined;
  readonly subtotal: number;
  readonly thresholds: { readonly percentAbove: number; readonly amountAbove: number };
}): ApprovalRequired[] {
  return discountApproval({
    amount: manualAmount(input.discount, input.subtotal),
    baseMinor: input.subtotal,
    thresholds: input.thresholds,
    lineIndex: undefined,
  });
}
