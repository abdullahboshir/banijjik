import { POSTING_KEY, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { describe, expect, it } from "vitest";
import type { PaymentPostingSnapshot } from "./posting-rules.js";
import { draftBadDebtWriteOff } from "./write-off-posting-rules.js";

const money = (amount: number) => ({ amount, currency: "BDT" as const });

function reversalSnapshot(writeOffs: PaymentPostingSnapshot["writeOffs"]): PaymentPostingSnapshot {
  return {
    paymentId: "reversal-1",
    businessDate: "2026-10-24",
    locationId: null,
    amount: money(500),
    method: "CASH",
    direction: "REVERSAL",
    allocations: [],
    reversesPaymentId: "payment-1",
    writeOffs,
  };
}

describe("bad debt for a written-off closed request (ADR-140)", () => {
  it("posts bad debt against customer advances when a booking's retained fee is forgiven", () => {
    const draft = draftBadDebtWriteOff(
      reversalSnapshot([
        { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: "b1", amount: money(500) },
      ]),
    );

    expect(draft?.postingKey).toBe(POSTING_KEY.bad_debt_written_off);
    expect(draft?.sourceId).toBe("reversal-1");
    expect(
      draft?.lines.map((line) => [line.accountCode, line.debit.amount, line.credit.amount]),
    ).toEqual([
      [SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE, 500, 0],
      [SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, 0, 500],
    ]);
  });

  it("sums every forgiven booking of one reversal into a single journal", () => {
    const draft = draftBadDebtWriteOff(
      reversalSnapshot([
        { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: "b1", amount: money(300) },
        { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: "b2", amount: money(200) },
      ]),
    );

    expect(draft?.lines[0]?.debit.amount).toBe(500);
    expect(draft?.lines[1]?.credit.amount).toBe(500);
  });

  it("refuses to sum write-offs in two currencies", () => {
    const snapshot = reversalSnapshot([
      { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: "b1", amount: money(300) },
      {
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        requestId: "b2",
        // CurrencyCode has one value today, so a second currency can only be forced in a test.
        amount: { amount: 200, currency: "USD" as unknown as "BDT" },
      },
    ]);

    expect(() => draftBadDebtWriteOff(snapshot)).toThrow();
  });

  it("posts bad debt for an enrollment write-off once its kept amount is income", () => {
    const draft = draftBadDebtWriteOff(
      reversalSnapshot([
        { requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT, requestId: "e1", amount: money(500) },
      ]),
    );

    expect(draft?.lines.map((line) => line.accountCode)).toEqual([
      SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE,
      SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES,
    ]);
  });

  it("posts nothing when no request was written off", () => {
    expect(draftBadDebtWriteOff(reversalSnapshot([]))).toBeUndefined();
    expect(draftBadDebtWriteOff(reversalSnapshot(undefined))).toBeUndefined();
  });

  it("ignores a zero amount and posts nothing for it", () => {
    const draft = draftBadDebtWriteOff(
      reversalSnapshot([
        { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: "b1", amount: money(0) },
      ]),
    );

    expect(draft).toBeUndefined();
  });
});
