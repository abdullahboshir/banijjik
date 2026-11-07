import type {
  PlatformReconciliationQuery,
  ReconciliationResponse,
  ReconciliationSourceType,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import {
  classifyReconciliationStatus,
  ReconciliationCursor,
  toDiscrepancyItem,
} from "../../domain/reconciliation.entity.js";
import type {
  ReconciliationCursorRepository,
  ReconciliationSourceScanner,
} from "../reconciliation-ports.js";

export interface RunReconciliationDependencies {
  readonly scanner: ReconciliationSourceScanner;
  readonly cursors: ReconciliationCursorRepository;
}

export class RunReconciliationUseCase {
  constructor(private readonly dependencies: RunReconciliationDependencies) {}

  async execute(input: {
    readonly query: PlatformReconciliationQuery;
    readonly updateCursor?: boolean | undefined;
  }): Promise<ReconciliationResponse> {
    const { query, updateCursor = false } = input;
    const organizationId = query.organizationId;
    const sourceType: ReconciliationSourceType = query.sourceType ?? "SALES_ORDER";
    const limit = query.limit ?? 50;

    let fromCreatedAt: Date | undefined;
    let fromId: string | undefined;

    if (query.cursor) {
      const [ts, id] = query.cursor.split("_");
      if (ts && id) {
        fromCreatedAt = new Date(Number(ts));
        fromId = id;
      }
    } else if (organizationId) {
      const persisted = await this.dependencies.cursors.findCursor(organizationId, sourceType);
      if (persisted) {
        fromCreatedAt = persisted.lastScannedCreatedAt;
        fromId = persisted.lastScannedId;
      }
    }

    const items = await this.dependencies.scanner.scanSources({
      organizationId,
      sourceType,
      fromCreatedAt,
      fromId,
      limit,
    });

    let postedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    const discrepancyItems = [];

    for (const item of items) {
      const status = classifyReconciliationStatus(item);
      if (status === "POSTED") {
        postedCount += 1;
      } else if (status === "PENDING") {
        pendingCount += 1;
        discrepancyItems.push(toDiscrepancyItem(item, status));
      } else {
        failedCount += 1;
        discrepancyItems.push(toDiscrepancyItem(item, status));
      }
    }

    let nextCursor: string | null = null;
    if (items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = `${last.createdAt.getTime()}_${last.sourceId}`;

      if (updateCursor && organizationId) {
        await this.dependencies.cursors.saveCursor(
          new ReconciliationCursor({
            reconciliationCursorId: newId(),
            organizationId,
            sourceType,
            lastScannedCreatedAt: last.createdAt,
            lastScannedId: last.sourceId,
            version: 0,
            updatedAt: new Date(),
          }),
        );
      }
    }

    return {
      summary: {
        scannedCount: items.length,
        postedCount,
        pendingCount,
        failedCount,
      },
      items: discrepancyItems,
      nextCursor,
    };
  }
}
