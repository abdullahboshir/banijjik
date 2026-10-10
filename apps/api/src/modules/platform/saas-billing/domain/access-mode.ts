import {
  ACCESS_MODE,
  PAST_DUE_GRACE_DAYS,
  SUBSCRIPTION_STATUS,
  type AccessMode,
  type SubscriptionStatus,
} from "@banijjik/contracts";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** The dates `accessModeOf` reads. A stored subscription and the cached copy of it both fit. */
export interface SubscriptionDates {
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  /** The due date of a PAST_DUE subscription. */
  readonly currentPeriodEnd: Date | null;
}

export interface AccessState {
  readonly accessMode: AccessMode;
  /** True inside the grace period: the admin app shows the banner (ADR-053). */
  readonly isPastDue: boolean;
}

const FULL_ACCESS: AccessState = { accessMode: ACCESS_MODE.FULL, isPastDue: false };
const READ_ONLY: AccessState = { accessMode: ACCESS_MODE.READ_ONLY, isPastDue: false };

function stateAfterDueDate(dueDate: Date | null, now: Date): AccessState {
  // A past-due subscription without a due date cannot prove it is inside the grace: fail safe.
  if (dueDate === null) return READ_ONLY;
  const graceEnds = dueDate.getTime() + PAST_DUE_GRACE_DAYS * MILLISECONDS_PER_DAY;
  if (now.getTime() < graceEnds) return { accessMode: ACCESS_MODE.FULL, isPastDue: true };
  return READ_ONLY;
}

function trialingState(subscription: SubscriptionDates, now: Date): AccessState {
  const { trialEndsAt } = subscription;
  if (trialEndsAt !== null && now.getTime() < trialEndsAt.getTime()) return FULL_ACCESS;
  // A trial that ends without a purchase is PAST_DUE since the day it ended (10-MODULE-CATALOG section 8).
  return stateAfterDueDate(trialEndsAt, now);
}

/**
 * What an organization may do right now (10-MODULE-CATALOG section 8, ADR-053). It is computed
 * from the dates on every read, so no job has to flip a status for the mode to be right.
 * No subscription at all is READ_ONLY.
 */
export function accessModeOf(subscription: SubscriptionDates | undefined, now: Date): AccessState {
  if (subscription === undefined) return READ_ONLY;
  switch (subscription.status) {
    case SUBSCRIPTION_STATUS.ACTIVE:
      return FULL_ACCESS;
    case SUBSCRIPTION_STATUS.TRIALING:
      return trialingState(subscription, now);
    case SUBSCRIPTION_STATUS.PAST_DUE:
      return stateAfterDueDate(subscription.currentPeriodEnd, now);
    case SUBSCRIPTION_STATUS.CANCELLED:
      return READ_ONLY;
  }
}
