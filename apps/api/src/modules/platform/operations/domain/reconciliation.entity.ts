import type {
  ReconciliationDiscrepancyItem,
  ReconciliationItemStatus,
  ReconciliationSourceType,
} from "@banijjik/contracts";

export interface ReconciliationCursorProps {
  readonly reconciliationCursorId: string;
  readonly organizationId: string;
  readonly sourceType: ReconciliationSourceType;
  readonly lastScannedCreatedAt: Date;
  readonly lastScannedId: string;
  readonly version: number;
  readonly updatedAt: Date;
}

export class ReconciliationCursor implements ReconciliationCursorProps {
  readonly reconciliationCursorId: string;
  readonly organizationId: string;
  readonly sourceType: ReconciliationSourceType;
  readonly lastScannedCreatedAt: Date;
  readonly lastScannedId: string;
  readonly version: number;
  readonly updatedAt: Date;

  constructor(props: ReconciliationCursorProps) {
    this.reconciliationCursorId = props.reconciliationCursorId;
    this.organizationId = props.organizationId;
    this.sourceType = props.sourceType;
    this.lastScannedCreatedAt = props.lastScannedCreatedAt;
    this.lastScannedId = props.lastScannedId;
    this.version = props.version;
    this.updatedAt = props.updatedAt;
  }
}

export interface ReconciledSourceItem {
  readonly sourceType: ReconciliationSourceType;
  readonly sourceId: string;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly isPosted: boolean;
  readonly hasPendingOutbox: boolean;
  readonly hasDeadLetter: boolean;
  readonly expectedTarget: string;
  readonly detail?: string | undefined;
}

export function classifyReconciliationStatus(item: ReconciledSourceItem): ReconciliationItemStatus {
  if (item.isPosted) return "POSTED";
  if (item.hasDeadLetter) return "FAILED";
  if (item.hasPendingOutbox) return "PENDING";
  return "FAILED";
}

export function toDiscrepancyItem(
  item: ReconciledSourceItem,
  status: ReconciliationItemStatus,
): ReconciliationDiscrepancyItem {
  return {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    organizationId: item.organizationId,
    status,
    sourceCreatedAt: item.createdAt.toISOString(),
    expectedTarget: item.expectedTarget,
    detail: item.detail,
  };
}
