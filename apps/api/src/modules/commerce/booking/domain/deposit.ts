import type { DepositRule } from "@banijjik/contracts/catalog";
import type { CancelFeeMode, DepositRequired, Money } from "@banijjik/contracts/booking";
import { CANCEL_FEE_MODE, DEPOSIT_REQUIRED } from "@banijjik/contracts/booking";

export interface DepositDisposition {
  readonly feeRetained: Money;
  readonly amountToCredit: Money;
}

/** Computes the deposit required at booking creation and confirmation (card 3.8). */
export function computeDepositRequired(input: {
  readonly orgMode: DepositRequired;
  readonly orgValue: number;
  readonly offeringRule: DepositRule | undefined;
  readonly lineTotal: Money;
}): Money {
  const rule = input.offeringRule;
  const mode = rule?.required ?? input.orgMode;
  const value = rule?.value ?? input.orgValue;
  const { currency } = input.lineTotal;
  if (mode === DEPOSIT_REQUIRED.NONE) {
    return { amount: 0, currency };
  }
  if (mode === DEPOSIT_REQUIRED.FULL) {
    return { amount: input.lineTotal.amount, currency };
  }
  if (mode === DEPOSIT_REQUIRED.FIXED) {
    return { amount: Math.max(0, value), currency };
  }
  if (mode === DEPOSIT_REQUIRED.PERCENT) {
    const percent = Math.min(100, Math.max(1, value));
    return { amount: Math.floor((input.lineTotal.amount * percent) / 100), currency };
  }
  return { amount: 0, currency };
}

function applyCancelFeeMode(input: {
  readonly netPaid: Money;
  readonly depositRequired: Money;
  readonly lineTotal: Money;
  readonly feeMode: CancelFeeMode;
  readonly feePercent: number;
}): DepositDisposition {
  const { currency } = input.netPaid;
  if (input.netPaid.amount <= 0 || input.feeMode === CANCEL_FEE_MODE.NONE) {
    return {
      feeRetained: { amount: 0, currency },
      amountToCredit: { amount: Math.max(0, input.netPaid.amount), currency },
    };
  }
  if (input.feeMode === CANCEL_FEE_MODE.PERCENT) {
    const percent = Math.min(100, Math.max(1, input.feePercent));
    const cap = Math.floor((input.lineTotal.amount * percent) / 100);
    const fee = Math.min(input.netPaid.amount, cap);
    return {
      feeRetained: { amount: fee, currency },
      amountToCredit: { amount: input.netPaid.amount - fee, currency },
    };
  }
  const cap =
    input.depositRequired.amount > 0 ? input.depositRequired.amount : input.netPaid.amount;
  const fee = Math.min(input.netPaid.amount, cap);
  return {
    feeRetained: { amount: fee, currency },
    amountToCredit: { amount: input.netPaid.amount - fee, currency },
  };
}

/** Computes how much of the paid deposit is retained vs credited on cancellation (11 §5.4). */
export function computeCancelDepositDisposition(input: {
  readonly netPaid: Money;
  readonly depositRequired: Money;
  readonly lineTotal: Money;
  readonly startsAt: Date;
  readonly now: Date;
  readonly freeCancelHours: number;
  readonly lateCancelFee: CancelFeeMode;
  readonly feePercent: number;
}): DepositDisposition {
  const { currency } = input.netPaid;
  if (input.netPaid.amount <= 0) {
    return {
      feeRetained: { amount: 0, currency },
      amountToCredit: { amount: 0, currency },
    };
  }
  const msUntilStart = input.startsAt.getTime() - input.now.getTime();
  const freeWindowMs = Math.max(0, input.freeCancelHours) * 60 * 60 * 1000;
  if (msUntilStart >= freeWindowMs) {
    return {
      feeRetained: { amount: 0, currency },
      amountToCredit: { amount: input.netPaid.amount, currency },
    };
  }
  return applyCancelFeeMode({
    netPaid: input.netPaid,
    depositRequired: input.depositRequired,
    lineTotal: input.lineTotal,
    feeMode: input.lateCancelFee,
    feePercent: input.feePercent,
  });
}

/** Computes how much of the paid deposit is retained vs credited on no-show (11 §5.4). */
export function computeNoShowDepositDisposition(input: {
  readonly netPaid: Money;
  readonly depositRequired: Money;
  readonly lineTotal: Money;
  readonly noShowFee: CancelFeeMode;
  readonly feePercent: number;
}): DepositDisposition {
  return applyCancelFeeMode({
    netPaid: input.netPaid,
    depositRequired: input.depositRequired,
    lineTotal: input.lineTotal,
    feeMode: input.noShowFee,
    feePercent: input.feePercent,
  });
}
