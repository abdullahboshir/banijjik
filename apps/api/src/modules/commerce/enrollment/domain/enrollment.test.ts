import { describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  ENROLLMENT_ACTION,
  ENROLLMENT_STATUS,
  ENROLLMENT_REFUND_POLICY,
} from "@banijjik/contracts/enrollment";
import { addBillingPeriod } from "./period-dates.js";
import { assertTransition, freezeEnrollment, unfreezeEnrollment } from "./transitions.js";
import { refundableAmount } from "./refunds.js";
import type { Enrollment, EnrollmentPeriod } from "./enrollment.entity.js";

function enrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    enrollmentId: newId(),
    enrollmentNumber: "000001",
    organizationId: newId(),
    locationId: newId(),
    contactId: newId(),
    billToContactId: newId(),
    offeringId: newId(),
    variantId: newId(),
    startsOn: "2026-01-01",
    status: "ACTIVE",
    autoRenew: false,
    currentEnrollmentPeriodId: newId(),
    securityDepositHeld: { amount: 0, currency: "BDT" },
    resourceIds: [],
    freezes: [],
    customFields: {},
    plan: {
      billingPeriod: { unit: "MONTH", count: 1 },
      freezeAllowed: true,
      maxFreezeDaysPerYear: 5,
      startRule: "ANY_DATE",
      autoRenewDefault: false,
    },
    firstRecurringFee: { amount: 10001, currency: "BDT" },
    version: 1,
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUserId: null,
    updatedByUserId: null,
    ...overrides,
  };
}
function period(overrides: Partial<EnrollmentPeriod> = {}): EnrollmentPeriod {
  return {
    enrollmentPeriodId: newId(),
    enrollmentId: newId(),
    organizationId: newId(),
    locationId: newId(),
    periodNumber: 1,
    periodStartsOn: "2026-01-01",
    periodEndsOn: "2026-01-31",
    fee: { amount: 10001, currency: "BDT" },
    sessionsUsed: 0,
    status: "PAID",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUserId: null,
    updatedByUserId: null,
    ...overrides,
  };
}

describe("enrollment business rules", () => {
  it.each([
    ["2025-01-31", { unit: "MONTH", count: 1 }, "2025-02-28"],
    ["2024-01-31", { unit: "MONTH", count: 1 }, "2024-02-29"],
    ["2024-02-29", { unit: "YEAR", count: 1 }, "2025-02-28"],
    ["2026-12-31", { unit: "DAY", count: 1 }, "2027-01-01"],
    ["2026-01-01", { unit: "WEEK", count: 2 }, "2026-01-15"],
  ] as const)("clamps billing arithmetic for %s", (start, billing, end) => {
    expect(addBillingPeriod(start, billing)).toBe(end);
  });

  it("changes only the latest period end on unfreeze, preserving its original end", () => {
    const original = period();
    const earlier = period({ periodNumber: 0, periodEndsOn: "2025-12-31" });
    const frozen = freezeEnrollment(enrollment(), original, "2026-01-10");
    expect(frozen.period.periodEndsOn).toBe(original.periodEndsOn);
    expect(frozen.period.originalEndsOn).toBe(original.periodEndsOn);
    const next = unfreezeEnrollment(frozen.enrollment, frozen.period, "2026-01-13");
    expect(next.period.periodEndsOn).toBe("2026-02-03");
    expect(next.enrollment.freezes[0]).toEqual({
      frozenOn: "2026-01-10",
      unfrozenOn: "2026-01-13",
      daysFrozen: 3,
    });
    expect(original.periodEndsOn).toBe("2026-01-31");
    expect(earlier.periodEndsOn).toBe("2025-12-31");
  });

  it("refuses the yearly freeze limit and counts earlier completed freezes", () => {
    const used = enrollment({
      freezes: [{ frozenOn: "2026-01-01", unfrozenOn: "2026-01-06", daysFrozen: 5 }],
    });
    expect(() => freezeEnrollment(used, period(), "2026-01-10")).toThrow();
    const frozen = freezeEnrollment(enrollment(), period(), "2026-01-10");
    expect(() => unfreezeEnrollment(frozen.enrollment, frozen.period, "2026-01-16")).toThrow();
  });

  it("refuses every transition outside the lifecycle table", () => {
    const allowed: Record<string, readonly string[]> = {
      activate: ["PENDING"],
      freeze: ["ACTIVE"],
      unfreeze: ["FROZEN"],
      cancel: ["PENDING", "ACTIVE", "FROZEN", "OVERDUE"],
      renew: ["ACTIVE", "OVERDUE"],
      expire: ["PENDING", "ACTIVE", "OVERDUE"],
      complete: ["ACTIVE", "OVERDUE"],
      markOverdue: ["ACTIVE"],
    };
    for (const status of Object.values(ENROLLMENT_STATUS)) {
      for (const action of Object.values(ENROLLMENT_ACTION)) {
        const check = () => assertTransition(enrollment({ status }), action);
        if (allowed[action]?.includes(status)) expect(check).not.toThrow();
        else expect(check).toThrow();
      }
    }
  });

  it("computes NONE, paid future-period and prorated refunds with integer arithmetic", () => {
    const current = period();
    const future = period({ periodStartsOn: "2026-02-01", periodEndsOn: "2026-02-28" });
    const unpaid = period({
      status: "OPEN",
      periodStartsOn: "2026-02-01",
      periodEndsOn: "2026-02-28",
    });
    expect(
      refundableAmount([current, future], "2026-01-16", {
        policy: ENROLLMENT_REFUND_POLICY.NONE,
        currency: "BDT",
      }).amount,
    ).toBe(0);
    expect(
      refundableAmount([current, future, unpaid], "2026-01-16", {
        policy: ENROLLMENT_REFUND_POLICY.UNUSED_PERIODS,
        currency: "BDT",
      }).amount,
    ).toBe(10001);
    expect(
      refundableAmount([current, future], "2026-01-16", {
        policy: ENROLLMENT_REFUND_POLICY.PRORATED,
        currency: "BDT",
      }).amount,
    ).toBe(5161);
  });
});
