import {
  PLATFORM_ROLE,
  type ReconciliationSourceType,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createPlatformActor,
  type PlatformActor,
} from "../../../../test-support/platform-world.js";
import {
  RunReconciliationUseCase,
  type RunReconciliationDependencies,
} from "../application/use-cases/run-reconciliation.use-case.js";
import type {
  ReconciliationCursorRepository,
  ReconciliationSourceScanner,
} from "../application/reconciliation-ports.js";
import type {
  ReconciledSourceItem,
  ReconciliationCursor,
} from "../domain/reconciliation.entity.js";

registerIamApiModels();

let harness: IamApiHarness;
let superAdmin: PlatformActor;

beforeAll(async () => {
  harness = await startIamApi();
  superAdmin = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  await harness.dispose();
});

class FakeScanner implements ReconciliationSourceScanner {
  readonly items: ReconciledSourceItem[] = [];

  async scanSources(input: {
    readonly organizationId?: string;
    readonly sourceType: ReconciliationSourceType;
    readonly fromCreatedAt?: Date;
    readonly fromId?: string;
    readonly limit: number;
  }): Promise<readonly ReconciledSourceItem[]> {
    return this.items.filter((item) => {
      if (input.organizationId && item.organizationId !== input.organizationId) return false;
      if (input.sourceType !== item.sourceType) return false;
      if (input.fromCreatedAt && item.createdAt <= input.fromCreatedAt) return false;
      return true;
    }).slice(0, input.limit);
  }
}

class FakeCursorRepo implements ReconciliationCursorRepository {
  private readonly store = new Map<string, ReconciliationCursor>();

  async findCursor(organizationId: string, sourceType: ReconciliationSourceType) {
    return this.store.get(`${organizationId}:${sourceType}`);
  }

  async saveCursor(cursor: ReconciliationCursor) {
    this.store.set(`${cursor.organizationId}:${cursor.sourceType}`, cursor);
  }
}

describe("Reconciliation Operations (4.3 COD I3)", () => {
  it("classifies items into POSTED, PENDING, and FAILED", async () => {
    const scanner = new FakeScanner();
    const cursors = new FakeCursorRepo();
    const useCase = new RunReconciliationUseCase({ scanner, cursors });

    const orgId = newId();
    const now = new Date();

    scanner.items.push(
      {
        sourceType: "SALES_ORDER",
        sourceId: "order-posted",
        organizationId: orgId,
        createdAt: new Date(now.getTime() - 30_000),
        isPosted: true,
        hasPendingOutbox: false,
        hasDeadLetter: false,
        expectedTarget: "Journal[ORDER, order_revenue]",
      },
      {
        sourceType: "SALES_ORDER",
        sourceId: "order-pending",
        organizationId: orgId,
        createdAt: new Date(now.getTime() - 20_000),
        isPosted: false,
        hasPendingOutbox: true,
        hasDeadLetter: false,
        expectedTarget: "Journal[ORDER, order_revenue]",
      },
      {
        sourceType: "SALES_ORDER",
        sourceId: "order-failed",
        organizationId: orgId,
        createdAt: new Date(now.getTime() - 10_000),
        isPosted: false,
        hasPendingOutbox: false,
        hasDeadLetter: true,
        expectedTarget: "Journal[ORDER, order_revenue]",
        detail: "Worker failure: timeout",
      },
    );

    const result = await useCase.execute({
      query: { organizationId: orgId, sourceType: "SALES_ORDER", limit: 10 },
      updateCursor: true,
    });

    expect(result.summary.scannedCount).toBe(3);
    expect(result.summary.postedCount).toBe(1);
    expect(result.summary.pendingCount).toBe(1);
    expect(result.summary.failedCount).toBe(1);

    expect(result.items).toHaveLength(2); // Only discrepancies (PENDING, FAILED)
    expect(result.items[0]?.sourceId).toBe("order-pending");
    expect(result.items[0]?.status).toBe("PENDING");
    expect(result.items[1]?.sourceId).toBe("order-failed");
    expect(result.items[1]?.status).toBe("FAILED");
  });

  it("persists cursor and resumes next batch forward", async () => {
    const scanner = new FakeScanner();
    const cursors = new FakeCursorRepo();
    const useCase = new RunReconciliationUseCase({ scanner, cursors });

    const orgId = newId();
    const t0 = new Date(1000);
    const t1 = new Date(2000);
    const t2 = new Date(3000);

    scanner.items.push(
      {
        sourceType: "COURIER_SETTLEMENT",
        sourceId: "cs-1",
        organizationId: orgId,
        createdAt: t0,
        isPosted: true,
        hasPendingOutbox: false,
        hasDeadLetter: false,
        expectedTarget: "Journal[COURIER, courier_settlement]",
      },
      {
        sourceType: "COURIER_SETTLEMENT",
        sourceId: "cs-2",
        organizationId: orgId,
        createdAt: t1,
        isPosted: false,
        hasPendingOutbox: true,
        hasDeadLetter: false,
        expectedTarget: "Journal[COURIER, courier_settlement]",
      },
      {
        sourceType: "COURIER_SETTLEMENT",
        sourceId: "cs-3",
        organizationId: orgId,
        createdAt: t2,
        isPosted: true,
        hasPendingOutbox: false,
        hasDeadLetter: false,
        expectedTarget: "Journal[COURIER, courier_settlement]",
      },
    );

    // First scan: limit 2
    const batch1 = await useCase.execute({
      query: { organizationId: orgId, sourceType: "COURIER_SETTLEMENT", limit: 2 },
      updateCursor: true,
    });

    expect(batch1.summary.scannedCount).toBe(2);
    expect(batch1.nextCursor).toBe(`${t1.getTime()}_cs-2`);

    // Second scan without cursor parameter: automatically picks up persisted cursor
    const batch2 = await useCase.execute({
      query: { organizationId: orgId, sourceType: "COURIER_SETTLEMENT", limit: 2 },
      updateCursor: true,
    });

    expect(batch2.summary.scannedCount).toBe(1);
    expect(batch2.summary.postedCount).toBe(1);
    expect(batch2.items).toHaveLength(0);
  });

  it("platform API endpoint GET /platform/reconciliation returns 200 with summary and items", async () => {
    const response = await superAdmin.call("get", "/reconciliation?sourceType=SALES_ORDER&limit=10");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toBeDefined();
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });

  it("platform API endpoint POST /platform/reconciliation/run runs scan and advances cursor", async () => {
    const response = await superAdmin.call("post", "/reconciliation/run", {
      sourceType: "COURIER_SETTLEMENT",
      limit: 5,
    });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toBeDefined();
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });
});
