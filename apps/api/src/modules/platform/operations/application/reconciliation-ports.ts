import type { ReconciliationSourceType } from "@banijjik/contracts";
import type { ReconciledSourceItem, ReconciliationCursor } from "../domain/reconciliation.entity.js";

export interface ScanSourcesInput {
  readonly organizationId?: string | undefined;
  readonly sourceType: ReconciliationSourceType;
  readonly fromCreatedAt?: Date | undefined;
  readonly fromId?: string | undefined;
  readonly limit: number;
}

export interface ReconciliationSourceScanner {
  scanSources(input: ScanSourcesInput): Promise<readonly ReconciledSourceItem[]>;
}

export interface ReconciliationCursorRepository {
  findCursor(
    organizationId: string,
    sourceType: ReconciliationSourceType,
  ): Promise<ReconciliationCursor | undefined>;
  saveCursor(cursor: ReconciliationCursor): Promise<void>;
}
