import {
  ACCESS_MODE,
  PAST_DUE_GRACE_DAYS,
  SUBSCRIPTION_STATUS,
  TRIAL_DAYS,
} from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { accessModeOf, type SubscriptionDates } from "./access-mode.js";

const START = new Date("2026-10-11T08:00:00.000Z");
const FULL = { accessMode: ACCESS_MODE.FULL, isPastDue: false };
const FULL_WITH_BANNER = { accessMode: ACCESS_MODE.FULL, isPastDue: true };
const READ_ONLY = { accessMode: ACCESS_MODE.READ_ONLY, isPastDue: false };

function daysAfter(date: Date, days: number): Date {
  const clock = new MutableClock(date);
  clock.advanceDays(days);
  return clock.now();
}

const trialing: SubscriptionDates = {
  status: SUBSCRIPTION_STATUS.TRIALING,
  trialEndsAt: daysAfter(START, TRIAL_DAYS),
  currentPeriodEnd: null,
};

describe("accessModeOf (10-MODULE-CATALOG section 8)", () => {
  it("is READ_ONLY when there is no subscription at all", () => {
    expect(accessModeOf(undefined, START)).toEqual(READ_ONLY);
  });

  it("is FULL while a trial runs, up to the last millisecond before it ends", () => {
    const trialEnd = trialing.trialEndsAt ?? START;

    expect(accessModeOf(trialing, START)).toEqual(FULL);
    expect(accessModeOf(trialing, new Date(trialEnd.getTime() - 1))).toEqual(FULL);
  });

  it("treats an ended trial as PAST_DUE since its end: FULL with the banner for 7 days, then READ_ONLY", () => {
    const trialEnd = trialing.trialEndsAt ?? START;

    expect(accessModeOf(trialing, trialEnd)).toEqual(FULL_WITH_BANNER);
    expect(accessModeOf(trialing, daysAfter(trialEnd, PAST_DUE_GRACE_DAYS - 1))).toEqual(
      FULL_WITH_BANNER,
    );
    expect(accessModeOf(trialing, daysAfter(trialEnd, PAST_DUE_GRACE_DAYS))).toEqual(READ_ONLY);
  });

  it("is FULL for an ACTIVE subscription", () => {
    const active = { ...trialing, status: SUBSCRIPTION_STATUS.ACTIVE };

    expect(accessModeOf(active, daysAfter(START, 400))).toEqual(FULL);
  });

  it("gives a PAST_DUE subscription 7 days of FULL with the banner counted from its due date", () => {
    const dueDate = START;
    const pastDue: SubscriptionDates = {
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      trialEndsAt: null,
      currentPeriodEnd: dueDate,
    };
    const justBeforeGraceEnds = new Date(daysAfter(dueDate, PAST_DUE_GRACE_DAYS).getTime() - 1);

    expect(accessModeOf(pastDue, dueDate)).toEqual(FULL_WITH_BANNER);
    expect(accessModeOf(pastDue, justBeforeGraceEnds)).toEqual(FULL_WITH_BANNER);
    expect(accessModeOf(pastDue, daysAfter(dueDate, PAST_DUE_GRACE_DAYS))).toEqual(READ_ONLY);
  });

  it("is READ_ONLY for a PAST_DUE subscription without a due date, and for CANCELLED", () => {
    const noDueDate: SubscriptionDates = {
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      trialEndsAt: null,
      currentPeriodEnd: null,
    };
    const cancelled = { ...trialing, status: SUBSCRIPTION_STATUS.CANCELLED };

    expect(accessModeOf(noDueDate, START)).toEqual(READ_ONLY);
    expect(accessModeOf(cancelled, START)).toEqual(READ_ONLY);
  });
});
