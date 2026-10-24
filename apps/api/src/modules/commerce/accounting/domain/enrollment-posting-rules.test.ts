import { POSTING_KEY, SYSTEM_ACCOUNT_CODE, type Money } from "@banijjik/contracts/accounting";
import { describe, expect, it } from "vitest";
import {
  draftPeriodClosed,
  draftPeriodRevenueRecognized,
  type EnrollmentPeriodClosureSnapshot,
} from "./enrollment-posting-rules.js";

const money = (amount: number): Money => ({ amount, currency: "BDT" });

// Test-only: a second currency the contracts do not yet type, to prove the mismatch guard.
const otherCurrency = (amount: number): Money => ({ amount, currency: "USD" }) as unknown as Money;

function periodSnapshot(overrides: Partial<EnrollmentPeriodClosureSnapshot> = {}) {
  return {
    enrollmentPeriodId: "period-1",
    businessDate: "2026-10-25",
    locationId: "location-1",
    fee: money(3000),
    heldAdvance: money(0),
    keptAmount: money(0),
    recognizedAmount: money(0),
    recognizedBeforeCancel: false,
    ...overrides,
  };
}

function linesOf(entries: ReturnType<typeof draftPeriodClosed>) {
  return entries.map((entry) => ({
    postingKey: entry.postingKey,
    lines: entry.lines.map((line) => ({
      code: line.accountCode,
      debit: line.debit.amount,
      credit: line.credit.amount,
    })),
  }));
}

describe("enrollment period revenue posting rules", () => {
  it("posts plan revenue and settles only the held advance", () => {
    const entries = draftPeriodRevenueRecognized(periodSnapshot({ heldAdvance: money(1000) }));
    expect(linesOf(entries)).toEqual([
      {
        postingKey: POSTING_KEY.enrollment_period_revenue,
        lines: [
          { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 3000, credit: 0 },
          { code: SYSTEM_ACCOUNT_CODE.REVENUE_PLAN, debit: 0, credit: 3000 },
        ],
      },
      {
        postingKey: POSTING_KEY.enrollment_period_advance_settle,
        lines: [
          { code: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, debit: 1000, credit: 0 },
          { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 0, credit: 1000 },
        ],
      },
    ]);
  });

  it("posts nothing for a zero fee or a waived period", () => {
    expect(draftPeriodRevenueRecognized(periodSnapshot({ fee: money(0) }))).toEqual([]);
  });

  it("a cancelled recognised period reverses the unkept part of its revenue", () => {
    const entries = draftPeriodClosed(
      periodSnapshot({
        keptAmount: money(1000),
        recognizedAmount: money(3000),
        recognizedBeforeCancel: true,
      }),
    );
    expect(linesOf(entries)).toEqual([
      {
        postingKey: POSTING_KEY.enrollment_period_revenue_cancel,
        lines: [
          { code: SYSTEM_ACCOUNT_CODE.REVENUE_PLAN, debit: 2000, credit: 0 },
          { code: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, debit: 0, credit: 2000 },
        ],
      },
    ]);
  });

  it("money kept for a period that never started is a cancellation fee", () => {
    const entries = draftPeriodClosed(
      periodSnapshot({ keptAmount: money(1000), heldAdvance: money(1000) }),
    );
    expect(linesOf(entries).map((entry) => entry.postingKey)).toEqual([
      POSTING_KEY.enrollment_period_cancellation_fee,
      POSTING_KEY.enrollment_period_advance_settle,
    ]);
  });

  it("the close event tells a period recognised at its start from one recognised at cancel even when the kept amount equals the fee", () => {
    const sameAmounts = {
      keptAmount: money(3000),
      recognizedAmount: money(3000),
    };
    const recognisedEarlier = draftPeriodClosed(
      periodSnapshot({ ...sameAmounts, recognizedBeforeCancel: true }),
    );
    const recognisedAtCancel = draftPeriodClosed(
      periodSnapshot({ ...sameAmounts, recognizedBeforeCancel: false }),
    );
    expect(recognisedEarlier).toEqual([]);
    expect(linesOf(recognisedAtCancel).map((entry) => entry.postingKey)).toEqual([
      POSTING_KEY.enrollment_period_cancellation_fee,
    ]);
  });

  it("throws on a currency mismatch between fee and kept amount", () => {
    expect(() => draftPeriodClosed(periodSnapshot({ keptAmount: otherCurrency(1000) }))).toThrow();
  });
});
