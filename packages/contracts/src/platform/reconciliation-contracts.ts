import { defineEnum } from "../define-enum.js";

/**
 * Reconciliation item status:
 * - POSTED: The source event and its expected financial journal or claim are committed.
 * - PENDING: The source event is recorded, journal/claim is awaiting outbox/worker processing.
 * - FAILED: The outbox/worker processing failed or was dead-lettered.
 */
export const RECONCILIATION_ITEM_STATUS = defineEnum([
  "POSTED",
  "PENDING",
  "FAILED",
]);

export type ReconciliationItemStatus =
  (typeof RECONCILIATION_ITEM_STATUS)[keyof typeof RECONCILIATION_ITEM_STATUS];

export const RECONCILIATION_SOURCE_TYPE = defineEnum([
  "SALES_ORDER",
  "COURIER_SETTLEMENT",
  "RIDER_HANDOVER",
]);

export type ReconciliationSourceType =
  (typeof RECONCILIATION_SOURCE_TYPE)[keyof typeof RECONCILIATION_SOURCE_TYPE];

export interface PlatformReconciliationQuery {
  readonly organizationId?: string | undefined;
  readonly sourceType?: ReconciliationSourceType | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

export interface PlatformReconciliationRunBody {
  readonly organizationId?: string | undefined;
  readonly sourceType?: ReconciliationSourceType | undefined;
  readonly limit?: number | undefined;
}

export interface ReconciliationDiscrepancyItem {
  readonly sourceType: ReconciliationSourceType;
  readonly sourceId: string;
  readonly organizationId: string;
  readonly status: ReconciliationItemStatus;
  readonly sourceCreatedAt: string;
  readonly expectedTarget: string;
  readonly detail?: string | undefined;
}

export interface ReconciliationSummary {
  readonly scannedCount: number;
  readonly postedCount: number;
  readonly pendingCount: number;
  readonly failedCount: number;
}

export interface ReconciliationResponse {
  readonly summary: ReconciliationSummary;
  readonly items: readonly ReconciliationDiscrepancyItem[];
  readonly nextCursor: string | null;
}
