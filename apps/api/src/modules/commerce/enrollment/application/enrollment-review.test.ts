import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_JOB,
  ENROLLMENT_RULE_KEY,
} from "@banijjik/contracts/enrollment";
import { transitionEnrollment } from "./transition-enrollment.js";
import { buildEnrollmentJobs } from "./enrollment-jobs.js";

const { jobError } = vi.hoisted(() => ({ jobError: vi.fn() }));
vi.mock("../../../../kernel/logger/index.js", () => ({ getLogger: () => ({ error: jobError }) }));
beforeEach(() => jobError.mockClear());
async function run(fixture: ReturnType<typeof reviewFixture>, key: string) {
  const job = buildEnrollmentJobs(fixture.dependencies).find((job) => job.jobKey === key);
  if (job === undefined) throw new Error("Missing job");
  expect(job.everyMinutes).toBe(60);
  await job.run("organization", fixture.dependencies.clock.now());
}
function events(fixture: ReturnType<typeof reviewFixture>, type: string) {
  return vi
    .mocked(fixture.dependencies.events.publish)
    .mock.calls.filter((call) => call[0] === type);
}

describe("R1 enrollment lifecycle and catch-up", () => {
  it("renews two days in advance, keeps the current period, refuses a second renewal and freeze", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed();
    const result = await transitionEnrollment(fixture.dependencies, {
      ...caller(row),
      action: "renew",
    });
    expect(result.enrollment.currentEnrollmentPeriodId).toBe(row.currentEnrollmentPeriodId);
    expect(fixture.periods.size).toBe(2);
    const next = [...fixture.periods.values()].find((period) => period.periodNumber === 2);
    expect(next).toMatchObject({
      periodStartsOn: "2026-04-01",
      periodEndsOn: "2026-04-30",
      fee: { amount: 2000 },
    });
    expect(events(fixture, ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWED)[0]?.[1]).toMatchObject({
      enrollmentPeriodId: next?.enrollmentPeriodId,
    });
    await expect(
      transitionEnrollment(fixture.dependencies, { ...caller(result.enrollment), action: "renew" }),
    ).rejects.toMatchObject({ messageKey: ENROLLMENT_RULE_KEY.ALREADY_RENEWED });
    await expect(
      transitionEnrollment(fixture.dependencies, {
        ...caller(result.enrollment),
        action: "freeze",
      }),
    ).rejects.toMatchObject({ messageKey: ENROLLMENT_RULE_KEY.ADVANCE_PERIOD });
  });
  it("promotes an advance period once at 01:00 and 02:00 without another renewed event", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed();
    await transitionEnrollment(fixture.dependencies, { ...caller(row), action: "renew" });
    fixture.setTime("2026-04-01T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    const promoted = fixture.rows.get(row.enrollmentId);
    expect(promoted?.currentEnrollmentPeriodId).not.toBe(row.currentEnrollmentPeriodId);
    fixture.setTime("2026-04-01T02:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(row.enrollmentId)).toEqual(promoted);
    expect(fixture.periods.size).toBe(2);
    expect(events(fixture, ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWED)).toHaveLength(1);
    expect(fixture.dependencies.audit.record).toHaveBeenCalledTimes(2);
  });
  it("expires a manual enrollment without an advance period", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed();
    fixture.setTime("2026-04-01T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(row.enrollmentId)?.status).toBe("EXPIRED");
  });
  it("refuses advance renewal at the fixed-term last period", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed();
    const fixed = { ...row, plan: { ...row.plan, fixedTermPeriods: 1 } };
    fixture.rows.set(row.enrollmentId, fixed);
    await expect(
      transitionEnrollment(fixture.dependencies, { ...caller(fixed), action: "renew" }),
    ).rejects.toMatchObject({ messageKey: ENROLLMENT_RULE_KEY.NOT_DUE });
    expect(fixture.periods.size).toBe(1);
  });
  it("unfreezes ten real days with seven credited days", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed({
      status: "FROZEN",
      freezes: [{ frozenOn: "2026-03-19", daysFrozen: 0 }],
    });
    fixture.rows.set(row.enrollmentId, { ...row, plan: { ...row.plan, maxFreezeDaysPerYear: 7 } });
    const result = await transitionEnrollment(fixture.dependencies, {
      ...caller(row),
      action: "unfreeze",
    });
    expect(result.enrollment.freezes[0]?.daysFrozen).toBe(10);
    expect(fixture.periods.get(row.currentEnrollmentPeriodId)?.periodEndsOn).toBe("2026-04-07");
  });
  it("automatically ends a freeze at its allowance then expires normally", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed({
      status: "FROZEN",
      freezes: [{ frozenOn: "2026-03-22", daysFrozen: 0 }],
    });
    fixture.rows.set(row.enrollmentId, { ...row, plan: { ...row.plan, maxFreezeDaysPerYear: 7 } });
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(row.enrollmentId)?.status).toBe("ACTIVE");
    expect(events(fixture, ENROLLMENT_EVENT_TYPE.ENROLLMENT_UNFROZEN)).toHaveLength(1);
    fixture.setTime("2026-04-08T02:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(row.enrollmentId)?.status).toBe("EXPIRED");
  });
  it("leaves an unlimited freeze alone", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed({
      status: "FROZEN",
      freezes: [{ frozenOn: "2026-03-01", daysFrozen: 0 }],
    });
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(row.enrollmentId)).toEqual(row);
  });
  it("expires an unavailable plan and still renews the next enrollment from its snapshot", async () => {
    const fixture = reviewFixture();
    const first = fixture.seed({ autoRenew: true });
    const second = fixture.seed({ autoRenew: true, organizationId: first.organizationId });
    vi.mocked(fixture.dependencies.context.canRenew).mockImplementation(
      async (body) => body.offeringId !== first.offeringId,
    );
    fixture.setTime("2026-04-01T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(first.enrollmentId)?.status).toBe("EXPIRED");
    expect(fixture.rows.get(second.enrollmentId)?.currentEnrollmentPeriodId).not.toBe(
      second.currentEnrollmentPeriodId,
    );
    expect(fixture.dependencies.context.plan).not.toHaveBeenCalled();
  });
  it("logs a failing fee quote and continues with the next enrollment", async () => {
    const fixture = reviewFixture();
    const first = fixture.seed({ autoRenew: true });
    const second = fixture.seed({ autoRenew: true, organizationId: first.organizationId });
    const error = new Error("Fee quote unavailable");
    vi.mocked(fixture.dependencies.context.fee).mockImplementation(
      async (_organizationId, body) => {
        if (body.offeringId === first.offeringId) throw error;
        return { amount: 2000, currency: "BDT" };
      },
    );
    fixture.setTime("2026-04-01T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.rows.get(first.enrollmentId)).toEqual(first);
    expect(jobError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "enrollment.job_item_failed",
        enrollmentId: first.enrollmentId,
        jobKey: ENROLLMENT_JOB.RENEW,
        err: error,
      }),
      expect.any(String),
    );
    expect(fixture.rows.get(second.enrollmentId)?.currentEnrollmentPeriodId).not.toBe(
      second.currentEnrollmentPeriodId,
    );
  });
  it("refuses manual renewal when the plan is no longer sellable", async () => {
    const fixture = reviewFixture();
    const row = fixture.seed();
    vi.mocked(fixture.dependencies.context.canRenew).mockResolvedValue(false);
    await expect(
      transitionEnrollment(fixture.dependencies, { ...caller(row), action: "renew" }),
    ).rejects.toMatchObject({ messageKey: ENROLLMENT_RULE_KEY.PLAN });
  });
  it("sends one reminder across two days inside the window", async () => {
    const fixture = reviewFixture();
    fixture.seed();
    await run(fixture, ENROLLMENT_JOB.REMIND);
    fixture.setTime("2026-03-30T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.REMIND);
    expect(events(fixture, ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWAL_DUE)).toHaveLength(1);
  });
  it("catches up a missed first reminder day", async () => {
    const fixture = reviewFixture();
    fixture.seed();
    fixture.setTime("2026-03-29T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.REMIND);
    expect(events(fixture, ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWAL_DUE)).toHaveLength(1);
  });
  it("auto-renews once on repeated hourly runs", async () => {
    const fixture = reviewFixture();
    fixture.seed({ autoRenew: true });
    fixture.setTime("2026-04-01T01:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    fixture.setTime("2026-04-01T02:00:00+06:00");
    await run(fixture, ENROLLMENT_JOB.RENEW);
    expect(fixture.periods.size).toBe(2);
    expect(events(fixture, ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWED)).toHaveLength(1);
  });
});

import { newId } from "@banijjik/ids";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentPaymentPort, EnrollmentRepository, EnrollmentSettings } from "./ports.js";
import type { EnrollmentDependencies } from "./dependencies.js";
import { businessDateOf } from "../../booking/index.js";

function reviewFixture() {
  let now = new Date("2026-03-29T02:00:00+06:00");
  const rows = new Map<string, Enrollment>();
  const periods = new Map<string, EnrollmentPeriod>();
  const settings: EnrollmentSettings = {
    graceDays: 5,
    reminderDays: 3,
    requirePayment: false,
    blockOverdue: true,
    lockPrice: false,
    refundPolicy: "UNUSED_PERIODS",
  };
  const repository: EnrollmentRepository = {
    insert: async (row, period) => {
      rows.set(row.enrollmentId, row);
      periods.set(period.enrollmentPeriodId, period);
    },
    find: async (key) => rows.get(key),
    findPeriod: async (_organizationId, key) => periods.get(key),
    currentPeriod: async (row) => {
      const period = periods.get(row.currentEnrollmentPeriodId);
      if (period === undefined) throw new Error("Missing current period");
      return period;
    },
    nextPeriod: async (row, period) =>
      [...periods.values()].find(
        (next) =>
          next.enrollmentId === row.enrollmentId && next.periodNumber === period.periodNumber + 1,
      ),
    periods: async (key) => [...periods.values()].filter((period) => period.enrollmentId === key),
    periodPage: async (key) => ({
      items: [...periods.values()].filter((period) => period.enrollmentId === key),
      hasNext: false,
    }),
    save: async (row) => {
      const saved = { ...row, version: row.version + 1 };
      rows.set(row.enrollmentId, saved);
      return saved;
    },
    savePeriod: async (period) => {
      periods.set(period.enrollmentPeriodId, { ...period, version: period.version + 1 });
    },
    insertPeriod: async (period) => {
      periods.set(period.enrollmentPeriodId, period);
    },
    takeSeat: vi.fn(),
    releaseSeat: vi.fn(),
    list: async () => ({ items: [...rows.values()], hasNext: false }),
    candidates: async (after) =>
      [...rows.values()]
        .filter((row) => after === undefined || row.enrollmentId > after)
        .sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId)),
    checkIn: vi.fn(),
    checkIns: async () => ({ items: [], hasNext: false }),
    markReminder: async (row) => {
      const stored = rows.get(row.enrollmentId);
      if (stored?.reminderSentForEnrollmentPeriodId === row.currentEnrollmentPeriodId) return false;
      rows.set(row.enrollmentId, {
        ...row,
        reminderSentForEnrollmentPeriodId: row.currentEnrollmentPeriodId,
        version: row.version + 1,
      });
      return true;
    },
  };
  const payments: EnrollmentPaymentPort = {
    initializeSummary: vi.fn(),
    touchForRevenue: vi.fn(),
    // The stored period status is the truth in this fixture: PAID periods report their fee, the rest nothing.
    readNetPaid: async ({ enrollmentPeriodId }) => {
      const period = periods.get(enrollmentPeriodId);
      return {
        amount: period?.status === "PAID" ? (period.fee.amount ?? 0) : 0,
        currency: "BDT" as const,
      };
    },
    readRefunded: async () => ({ amount: 0, currency: "BDT" as const }),
    readRefundedMany: async () => new Map(),
    capTotalAtNetPaid: vi.fn(),
    listPeriodIdsOfPayment: async () => [],
  };
  const dependencies: EnrollmentDependencies = {
    repository,
    payments,
    context: {
      today: async (_organizationId, date) => businessDateOf(date, "Asia/Dhaka"),
      canRenew: vi.fn(async () => true),
      settings: async () => settings,
      plan: vi.fn(async () => {
        throw new Error("Renewal must use the snapshot");
      }),
      fee: vi.fn(async () => ({ amount: 2000, currency: "BDT" as const })),
      payer: async (_organizationId, contactId) => contactId,
      fields: async (_organizationId, values) => values,
      activeContact: async () => true,
      bookingForToday: async () => undefined,
    },
    holds: { take: vi.fn(), release: vi.fn() },
    unitOfWork: { run: async (work) => work() },
    audit: { record: vi.fn() },
    clock: { now: () => now },
    approvals: { consume: vi.fn() },
    events: { publish: vi.fn() },
  };
  function seed(overrides: Partial<Enrollment> = {}) {
    const common = {
      organizationId: newId(),
      locationId: newId(),
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };
    const row: Enrollment = {
      ...common,
      enrollmentId: newId(),
      enrollmentNumber: "000001",
      contactId: newId(),
      billToContactId: newId(),
      offeringId: newId(),
      variantId: newId(),
      startsOn: "2026-03-01",
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
        startRule: "ANY_DATE",
        autoRenewDefault: false,
      },
      firstRecurringFee: { amount: 1000, currency: "BDT" },
      version: 1,
      history: [],
      ...overrides,
    };
    const period: EnrollmentPeriod = {
      ...common,
      enrollmentPeriodId: row.currentEnrollmentPeriodId,
      enrollmentId: row.enrollmentId,
      periodNumber: 1,
      periodStartsOn: "2026-03-01",
      periodEndsOn: "2026-03-31",
      fee: row.firstRecurringFee,
      sessionsUsed: 0,
      status: "PAID",
      version: 1,
    };
    rows.set(row.enrollmentId, row);
    periods.set(period.enrollmentPeriodId, period);
    return row;
  }
  return {
    dependencies,
    rows,
    periods,
    settings,
    seed,
    setTime: (date: string) => {
      now = new Date(date);
    },
  };
}
export function caller(row: Enrollment) {
  return {
    organizationId: row.organizationId,
    enrollmentId: row.enrollmentId,
    actorUserId: null,
    allowedLocationIds: "ALL" as const,
    version: row.version,
  };
}
