import { DIRECTORY_API_MESSAGE_KEYS, LISTING_REPORT_OUTCOME } from "@banijjik/contracts/directory";
import type { ListingReportOutcome } from "@banijjik/contracts/directory";
import { ApiError } from "../lib/api/api-error";

export interface ResolveOutcomePermissions {
  /** `directory.listing.hide`: the API asks for it again when the outcome hides the listing. */
  canHide: boolean;
  /** `contact.customerAccount.block`: the API asks for it again when the outcome blocks the account. */
  canBlockAccounts: boolean;
}

/** The outcomes this staff member may choose; the API refuses the rest, the screen just does not offer them. */
export function resolveOutcomeOptions(
  permissions: ResolveOutcomePermissions,
): readonly ListingReportOutcome[] {
  return [
    LISTING_REPORT_OUTCOME.DISMISSED,
    LISTING_REPORT_OUTCOME.WARNED,
    ...(permissions.canHide ? [LISTING_REPORT_OUTCOME.LISTING_HIDDEN] : []),
    ...(permissions.canBlockAccounts ? [LISTING_REPORT_OUTCOME.ACCOUNT_BLOCKED] : []),
  ];
}

/** True when the API says the reports changed since the screen loaded (M.7 decision 5). */
export function isStaleReportError(error: unknown): boolean {
  return error instanceof ApiError && error.messageKey === DIRECTORY_API_MESSAGE_KEYS.reportStale;
}

export type ReportAge = { unit: "minutes" | "hours" | "days"; count: number };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Age of the oldest open report, in the largest whole unit (at least one minute). */
export function reportAgeOf(oldestReportAt: string, now: Date): ReportAge {
  const elapsed = Math.max(0, now.getTime() - new Date(oldestReportAt).getTime());
  if (elapsed >= DAY_MS) return { unit: "days", count: Math.floor(elapsed / DAY_MS) };
  if (elapsed >= HOUR_MS) return { unit: "hours", count: Math.floor(elapsed / HOUR_MS) };
  return { unit: "minutes", count: Math.max(1, Math.floor(elapsed / MINUTE_MS)) };
}
