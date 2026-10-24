import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { InventoryDependencies } from "../application/inventory-dependencies.js";
import { StockLedger } from "../application/stock-ledger.port.js";
import { StockLedgerService } from "../application/stock-ledger.service.js";
import { MongoCatalogOfferingReader } from "./mongo-catalog-offering.reader.js";
import { MongoInventoryItemRepository } from "./mongo-inventory-item.repository.js";
import {
  MongoInventoryLevelRepository,
  MongoStockMovementRepository,
  MongoStockReservationRepository,
} from "./mongo-stock.repository.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function buildPort(allowNegative = false): {
  readonly ledger: StockLedger;
  readonly published: { type: string; payload: unknown }[];
} {
  const published: { type: string; payload: unknown }[] = [];
  const movements = new MongoStockMovementRepository();
  const levels = new MongoInventoryLevelRepository();
  const events = {
    publish: async (type: string, payload: unknown) => {
      published.push({ type, payload });
    },
  };
  const stockLedger = new StockLedgerService({
    clock: harness.clock,
    events,
    movements,
    levels,
  });
  const dependencies = {
    items: new MongoInventoryItemRepository(),
    movements,
    levels,
    reservations: new MongoStockReservationRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events,
    audit: { record: async () => undefined },
    clock: harness.clock,
    settings: {
      allowNegativeStock: async () => allowNegative,
      lowStockDefault: async () => 0,
      adjustmentApprovalAbove: async () => 0,
      lowStockThresholdForItem: async (
        _organizationId: OrganizationId,
        itemThreshold: number | undefined,
      ) => itemThreshold ?? 0,
    },
    currency: { read: async () => "BDT" },
    locations: { isActiveLocation: async () => true },
    sequences: { nextTransferNumber: async () => "T-1" },
    offerings: new MongoCatalogOfferingReader(),
    approvals: { consume: async () => undefined },
    stockLedger,
  } as unknown as InventoryDependencies;
  return { ledger: new StockLedger(dependencies), published };
}

async function seedTrackedOffering(
  world: Awaited<ReturnType<typeof worldFor>>,
  locationId: string,
): Promise<{
  readonly inventoryItemId: string;
  readonly offeringId: string;
  readonly variantId: string;
}> {
  const item = (
    await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
      name: "Port rice",
      baseUnitKey: "GRAM",
    })
  ).body.data;
  await world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/stock/receipts`,
    body: {
      locationId,
      paidVia: "CASH",
      lines: [{ inventoryItemId: item.inventoryItemId, quantity: 1000, unitCost: money(10) }],
    },
    idempotencyKey: newId(),
  });
  const offering = (
    await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Port pack",
      variants: [
        {
          price: money(100),
          unitKey: "PIECE",
          stockComponents: [{ inventoryItemId: item.inventoryItemId, quantity: 100 }],
        },
      ],
    })
  ).body.data;
  // StockLedger expands only ACTIVE offerings (sales path); drafts are catalog-only.
  await world.alice.call(
    "post",
    offeringsPath(world.organizationA, `/${offering.offeringId}/publish`),
    {
      version: offering.version,
    },
  );
  return {
    inventoryItemId: item.inventoryItemId as string,
    offeringId: offering.offeringId as string,
    variantId: offering.variants[0].variantId as string,
  };
}

describe("StockLedger port", () => {
  it("exports buildStockLedger for order integration (card 3.5)", async () => {
    const { buildStockLedger } = await import("../index.js"); // public export for card 3.5
    expect(typeof buildStockLedger).toBe("function");
  });

  it("reserve and release are idempotent; commitSale writes one SALE per component and clears reserved", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const seeded = await seedTrackedOffering(world, locationId);
    const { ledger } = buildPort();
    const sourceId = newId();
    const input = {
      organizationId: asId<OrganizationId>(world.organizationA),
      locationId,
      actorUserId: asId<UserId>(world.alice.userId),
      sourceType: STOCK_SOURCE_TYPE.ORDER,
      sourceId,
      lines: [
        {
          offeringId: seeded.offeringId,
          variantId: seeded.variantId,
          quantity: 2,
        },
      ],
      allowNegativeStock: false,
    };

    await runInOrganizationContext(world.organizationA, async () => {
      await ledger.reserve(input);
      await ledger.reserve(input);
    });

    let levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    let row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === seeded.inventoryItemId,
    );
    expect(row.reserved).toBe(200);
    expect(row.available).toBe(800);

    await runInOrganizationContext(world.organizationA, async () => {
      await ledger.commitSale(input);
    });

    levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === seeded.inventoryItemId,
    );
    expect(row.onHand).toBe(800);
    expect(row.reserved).toBe(0);
    expect(row.available).toBe(800);

    const movements = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/movements?inventoryItemId=${seeded.inventoryItemId}&limit=100`,
    );
    const sales = (movements.body.data as { reason: string }[]).filter(
      (movement) => movement.reason === "SALE",
    );
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ quantityDelta: -200 });

    await runInOrganizationContext(world.organizationA, async () => {
      await ledger.release(input);
      await ledger.release(input);
    });
    levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === seeded.inventoryItemId,
    );
    expect(row.reserved).toBe(0);
  });

  it("returnStock RESTOCK raises onHand; RETURN_DAMAGED raises damaged only", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const seeded = await seedTrackedOffering(world, locationId);
    const { ledger } = buildPort();
    const base = {
      organizationId: asId<OrganizationId>(world.organizationA),
      locationId,
      actorUserId: asId<UserId>(world.alice.userId),
      sourceType: STOCK_SOURCE_TYPE.ORDER,
      lines: [
        {
          offeringId: seeded.offeringId,
          variantId: seeded.variantId,
          quantity: 1,
        },
      ],
      allowNegativeStock: false,
    };

    await runInOrganizationContext(world.organizationA, async () => {
      await ledger.returnStock({ ...base, sourceId: newId(), disposition: "RETURN" });
      await ledger.returnStock({
        ...base,
        sourceId: newId(),
        disposition: "RETURN_DAMAGED",
      });
    });

    const levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    const row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === seeded.inventoryItemId,
    );
    expect(row.onHand).toBe(1100);
    expect(row.damaged).toBe(100);

    const movements = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/movements?inventoryItemId=${seeded.inventoryItemId}&limit=100`,
    );
    const damagedReturn = (movements.body.data as { reason: string; stockState: string }[]).find(
      (movement) => movement.reason === "RETURN_DAMAGED",
    );
    expect(damagedReturn?.stockState).toBe("DAMAGED");
  });

  it("commitSale fails closed when no reservation exists", async () => {
    const world = await worldFor(harness, RETAIL);
    const seeded = await seedTrackedOffering(world, world.locationA1);
    const { ledger } = buildPort();
    await expect(
      runInOrganizationContext(world.organizationA, async () => {
        await ledger.commitSale({
          organizationId: asId<OrganizationId>(world.organizationA),
          locationId: world.locationA1,
          actorUserId: asId<UserId>(world.alice.userId),
          sourceType: STOCK_SOURCE_TYPE.ORDER,
          sourceId: newId(),
          lines: [
            {
              offeringId: seeded.offeringId,
              variantId: seeded.variantId,
              quantity: 1,
            },
          ],
          allowNegativeStock: false,
        });
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
