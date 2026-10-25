import { REPORT_COUNTER } from "@banijjik/contracts/report";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { MutableCounters } from "../domain/summary-counters.js";

export const DAILY_SUMMARY_MODEL_NAME = "DailySummary";
export const DAILY_SUMMARY_COLLECTION_NAME = "report_daily_summaries";
export const REPORT_EVENT_APPLIED_MODEL_NAME = "ReportEventApplied";
export const REPORT_EVENT_APPLIED_COLLECTION_NAME = "report_event_applied";

/** The marker is kept for 400 days: longer than any redelivery or replay window (plan 3.10 decision 3). */
export const REPORT_EVENT_MARKER_TTL_SECONDS = 400 * 24 * 60 * 60;

/** One stored row. Counters are top-level numbers so the increment is a plain `$inc`. */
export type DailySummaryDocument = {
  dailySummaryId: string;
  organizationId: string;
  locationId: string;
  businessDate: string;
  currency: string;
  paidInByMethod: Record<string, number>;
  refundedByMethod: Record<string, number>;
  reversedByMethod: Record<string, number>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
} & MutableCounters;

export interface ReportEventAppliedDocument {
  reportEventAppliedId: string;
  organizationId: string;
  eventId: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const counterFields = Object.fromEntries(
  Object.values(REPORT_COUNTER).map((counter) => [counter, { type: Number, default: 0 }]),
);

export const dailySummarySchema = new Schema<DailySummaryDocument>(
  {
    ...domainIdField("dailySummaryId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    businessDate: { type: String, required: true, immutable: true },
    currency: { type: String, required: true, immutable: true },
    ...counterFields,
    paidInByMethod: { type: Schema.Types.Mixed, default: {} },
    refundedByMethod: { type: Schema.Types.Mixed, default: {} },
    reversedByMethod: { type: Schema.Types.Mixed, default: {} },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// One row per location and day; the home and the reports read by organization, then day, then location.
dailySummarySchema.index({ organizationId: 1, locationId: 1, businessDate: 1 }, { unique: true });
dailySummarySchema.index({ organizationId: 1, businessDate: 1, locationId: 1 });

export const reportEventAppliedSchema = new Schema<ReportEventAppliedDocument>(
  {
    ...domainIdField("reportEventAppliedId"),
    organizationId: { type: String, required: true, immutable: true },
    eventId: { type: String, required: true, immutable: true },
    appliedAt: { type: Date, required: true, immutable: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

reportEventAppliedSchema.index({ organizationId: 1, eventId: 1 }, { unique: true });
reportEventAppliedSchema.index(
  { appliedAt: 1 },
  { expireAfterSeconds: REPORT_EVENT_MARKER_TTL_SECONDS },
);
