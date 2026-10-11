import {
  ACCESS_MODE,
  SUBSCRIPTION_STATUS,
  type ResolvedOrgConfigResponse,
} from "@banijjik/contracts";

/** The trial banner shows in the last 7 days of the trial (13-UX section 5). */
export const TRIAL_BANNER_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type BannerState =
  { kind: "readOnly" } | { kind: "pastDue" } | { kind: "trial"; daysLeft: number };

/** The calendar date (`2026-10-10`) of an instant in a time zone, so "days left" follows the business's day. */
function calendarDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return Date.parse(`${parts}T00:00:00Z`) / MILLISECONDS_PER_DAY;
}

function trialDaysLeft(
  config: ResolvedOrgConfigResponse,
  now: Date,
  timeZone: string,
): number | undefined {
  const { subscription } = config;
  if (subscription?.status !== SUBSCRIPTION_STATUS.TRIALING) return undefined;
  if (subscription.trialEndsAt === null) return undefined;
  const daysLeft =
    calendarDay(new Date(subscription.trialEndsAt), timeZone) - calendarDay(now, timeZone);
  return daysLeft >= 0 && daysLeft <= TRIAL_BANNER_DAYS ? daysLeft : undefined;
}

/**
 * Which banners the business sees, strongest first. Read-only is persistent; past due (still inside the
 * grace period) is a warning; the trial banner appears in the last 7 days of the trial.
 */
export function bannerStatesOf(
  config: ResolvedOrgConfigResponse,
  now: Date,
  timeZone: string,
): BannerState[] {
  if (config.accessMode === ACCESS_MODE.READ_ONLY) return [{ kind: "readOnly" }];
  if (config.isPastDue) return [{ kind: "pastDue" }];
  const daysLeft = trialDaysLeft(config, now, timeZone);
  return daysLeft === undefined ? [] : [{ kind: "trial", daysLeft }];
}
