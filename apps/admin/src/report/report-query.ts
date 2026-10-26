import { REPORT_DAILY_MAX_DAYS } from "@banijjik/contracts/report";
import {
  DEFAULT_RANGE_DAYS,
  inclusiveDayCount,
  isBusinessDate,
  shiftBusinessDate,
} from "./report-dates";

type RawParam = string | string[] | undefined;

const LOCATION_ID_PATTERN = /^[0-9a-fA-F-]{36}$/u;

export interface ReportRangeQuery {
  readonly from: string;
  readonly to: string;
  /** Absent for every location the caller can see. */
  readonly locationId: string | undefined;
}

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function locationOf(value: RawParam): string | undefined {
  const text = firstOf(value);
  return text !== undefined && LOCATION_ID_PATTERN.test(text) ? text : undefined;
}

/** A range the screen can ask the API for: both dates real, not reversed, at most the API's day limit. */
function isUsableRange(from: string, to: string): boolean {
  const days = inclusiveDayCount(from, to);
  return days >= 1 && days <= REPORT_DAILY_MAX_DAYS;
}

/**
 * The reports page state lives in the URL (`?from=&to=&location=`). Unreadable dates or a range the API
 * would refuse fall back to the default: the last 7 days up to today in the business time zone.
 */
export function parseReportRangeQuery(
  params: Record<string, RawParam>,
  today: string,
): ReportRangeQuery {
  const requestedFrom = firstOf(params["from"]);
  const requestedTo = firstOf(params["to"]);
  const to = isBusinessDate(requestedTo) ? requestedTo : today;
  const from = isBusinessDate(requestedFrom)
    ? requestedFrom
    : shiftBusinessDate(to, 1 - DEFAULT_RANGE_DAYS);
  const usable = isUsableRange(from, to);
  return {
    from: usable ? from : shiftBusinessDate(today, 1 - DEFAULT_RANGE_DAYS),
    to: usable ? to : today,
    locationId: locationOf(params["location"]),
  };
}

/** The API path of the daily read for one range: one page holds every day of a range of at most 92 days. */
export function dailyReportPath(organizationId: string, query: ReportRangeQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to, limit: "100" });
  if (query.locationId) params.set("location", query.locationId);
  return `/orgs/${organizationId}/reports/daily?${params.toString()}`;
}

/** The API path of the home read; `location` is set only when the screen filters by one location. */
export function homeReportPath(organizationId: string, locationId: string | undefined): string {
  if (locationId === undefined) return `/orgs/${organizationId}/reports/home`;
  return `/orgs/${organizationId}/reports/home?${new URLSearchParams({ location: locationId }).toString()}`;
}

/** The location picker value from the URL, for the home page. */
export function homeLocationOf(params: Record<string, RawParam>): string | undefined {
  return locationOf(params["location"]);
}
