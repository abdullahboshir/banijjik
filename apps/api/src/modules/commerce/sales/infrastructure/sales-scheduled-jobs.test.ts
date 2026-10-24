import { AUDIT_ACTION, ERROR_CODE, MODULE_KEY } from "@banijjik/contracts";
import { SALES_CANCEL_REASON, SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { countAuditRows } from "../../../../test-support/organization-tenant-world.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import type { ScheduledJob } from "../../../../kernel/jobs/index.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import { buildSalesJobPortsForWorker } from "../../../../routes/sales-tenant-router.js";
import { buildAuditRecorder } from "../../../core/audit/index.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import {
  addCustomer,
  addInventoryItem,
  draftOrder,
  levelOf,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";
import { buildAutoCancelPlacedJob } from "../application/jobs/auto-cancel-placed.job.js";
import { buildExpireDraftsJob } from "../application/jobs/expire-drafts.job.js";
import { buildSalesJobDependencies } from "../sales-wiring.js";
import type { Order } from "../domain/order.entity.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PACK_GRAMS = 1_000;
const PACK_PRICE = 10_000;
const RICE_COST_PER_GRAM = 60;
const RAHIM_PHONE = "+8801700000001";
/** A contact dedupes on the phone inside one organization, so the second placed order needs one. */
const KARIM_PHONE = "+8801700000002";
const PACKS_ON_SHELF = 4;
const HOURS_PER_DAY = 24;
/** `sales.draftExpiryHours` defaults to 48, so this age is past the window and a fresh draft is not. */
const AGE_PAST_DRAFT_WINDOW_HOURS = 60;
const AUTO_CANCEL_AFTER_HOURS = 24;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

/**
 * The worker's own bag, so the test runs the job the worker runs (decisions 4 and 5). Only the
 * effective-module read is faked: `SettingsResolver` asks the request context for the
 * organization's `configVersion`, which a job never has (written into the card handoff as the gap).
 * The setting values themselves are read from the real rows and the industry template.
 */
function jobDependenciesOf() {
  const orgConfig = {
    current: async () => ({ modules: [MODULE_KEY.SALES, MODULE_KEY.INVENTORY] }),
  } as unknown as OrgConfigService;
  const registry = buildModuleRegistry();
  return buildSalesJobDependencies(
    buildSalesJobPortsForWorker({
      clock: harness.clock,
      audit: buildAuditRecorder(harness.clock),
      orgConfig,
      manifests: registry.all(),
    }),
  );
}

/** One pass, exactly as `kernel/jobs` runs it: in the organization's context, at the clock's time. */
async function runPass(job: ScheduledJob, organizationId: string): Promise<void> {
  const branded = asId<OrganizationId>(organizationId);
  await runInOrganizationContext(organizationId, () => job.run(branded, harness.clock.now()));
}

/**
 * Ages a row by writing its `createdAt` in the tenant database. Moving the harness clock instead
 * would expire the test's own API session, and every later request would answer 401.
 */
async function ageOrder(shop: SalesShop, orderId: string, hours: number): Promise<void> {
  const createdAt = new Date(harness.clock.now().getTime() - hours * MILLISECONDS_PER_HOUR);
  await harness.connections.tenantShared
    .collection("orders")
    .updateOne({ organizationId: shop.organizationId, orderId }, { $set: { createdAt } });
}

interface Pack {
  readonly offeringId: string;
  readonly variantId: string;
  readonly riceItemId: string;
}

async function shelfOf(shop: SalesShop): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, "Rice");
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Rice 1kg pack",
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    {
      inventoryItemId: riceItemId,
      quantity: PACKS_ON_SHELF * PACK_GRAMS,
      unitCostAmount: RICE_COST_PER_GRAM,
    },
  ]);
  return { ...pack, riceItemId };
}

/** A placed order of one pack: a candidate for the auto-cancel pass, with a reservation held. */
async function placedOrderOf(shop: SalesShop, pack: Pack, phone = RAHIM_PHONE) {
  const contactId = await addCustomer(shop, "Rahim", phone);
  const draft = await draftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    lines: [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity: 1 }],
  });
  return placeOrder(shop, { orderId: draft.orderId, version: draft.version });
}

async function emptyDraft(shop: SalesShop) {
  return draftOrder(shop, { locationId: shop.locationId, lines: [] });
}

async function orderRow(shop: SalesShop, orderId: string): Promise<Record<string, unknown>> {
  const response = await shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}`));
  expect(response.status).toBe(200);
  return response.body.data as Record<string, unknown>;
}

/** A CONFLICT shaped the way a raced version check answers (kernel/db versioned-update). */
function rowRacedError(): AppError {
  return new AppError({ code: ERROR_CODE.CONFLICT, details: { currentVersion: 99 } });
}

/**
 * The job's bag with one row's write failing, the way a writer racing the pass would leave it.
 * The pass must skip that row and still reach the orders behind it (R1-4).
 */
function jobWhoseRowFails(orderId: string, error: unknown) {
  const dependencies = jobDependenciesOf();
  const storedUpdate = dependencies.orders.update.bind(dependencies.orders);
  Object.assign(dependencies.orders, {
    update: async (order: Order, expectedVersion: number) => {
      if (order.orderId === orderId) throw error;
      return storedUpdate(order, expectedVersion);
    },
  });
  return dependencies;
}

describe("the hourly sales passes", () => {
  it("discards drafts older than the expiry setting and leaves the rest alone", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const old = await emptyDraft(shop);
    await ageOrder(shop, old.orderId, AGE_PAST_DRAFT_WINDOW_HOURS);
    const fresh = await emptyDraft(shop);
    const pack = await shelfOf(shop);
    const placed = await placedOrderOf(shop, pack);

    const job = buildExpireDraftsJob(jobDependenciesOf());
    await runPass(job, world.organizationA);
    await runPass(job, world.organizationA);

    const discarded = await shop.actor.call(
      "get",
      ordersPath(shop.organizationId, `/${old.orderId}`),
    );
    expect(discarded.status).toBe(404);
    expect((await orderRow(shop, fresh.orderId)).status).toBe("DRAFT");
    expect((await orderRow(shop, placed.order.orderId)).status).toBe("PLACED");
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });
  });

  it("does not cancel a placed order while the auto-cancel window is off", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const placed = await placedOrderOf(shop, pack);
    await ageOrder(shop, placed.order.orderId, AUTO_CANCEL_AFTER_HOURS * HOURS_PER_DAY);

    const job = buildAutoCancelPlacedJob(jobDependenciesOf());
    await runPass(job, world.organizationA);

    // The default of `sales.placedAutoCancelHours` is 0, which means the rule is off.
    expect((await orderRow(shop, placed.order.orderId)).status).toBe("PLACED");
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });
  });

  it("cancels a placed order past its window, releases the stock and does it once", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.placedAutoCancelHours", AUTO_CANCEL_AFTER_HOURS);
    const pack = await shelfOf(shop);
    const placed = await placedOrderOf(shop, pack);
    await ageOrder(shop, placed.order.orderId, AGE_PAST_DRAFT_WINDOW_HOURS);

    const job = buildAutoCancelPlacedJob(jobDependenciesOf());
    await runPass(job, world.organizationA);
    await runPass(job, world.organizationA);

    expect((await orderRow(shop, placed.order.orderId)).status).toBe("CANCELLED");
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 0,
    });
    expect(
      await countAuditRows(harness.connections, {
        organizationId: shop.organizationId,
        action: AUDIT_ACTION.ORDER_CANCELLED,
        entityId: placed.order.orderId,
      }),
    ).toBe(1);
    const auditRow = await harness.connections.tenantShared.collection("audit_logs").findOne({
      organizationId: shop.organizationId,
      action: AUDIT_ACTION.ORDER_CANCELLED,
      entityId: placed.order.orderId,
    });
    const changes = auditRow?.["changes"] as Record<string, { to?: string }> | undefined;
    expect(changes?.cancelReason?.to).toBe(SALES_CANCEL_REASON.AUTO_PLACED_TIMEOUT);
    expect(
      await harness.connections.platform.collection("outbox_events").countDocuments({
        organizationId: shop.organizationId,
        type: SALES_EVENT_TYPE.ORDER_CANCELLED,
        "payload.orderId": placed.order.orderId,
      }),
    ).toBe(1);
  });

  it("skips a row another writer raced and still cancels the order behind it", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.placedAutoCancelHours", AUTO_CANCEL_AFTER_HOURS);
    const pack = await shelfOf(shop);
    const raced = await placedOrderOf(shop, pack);
    const behind = await placedOrderOf(shop, pack, KARIM_PHONE);
    await ageOrder(shop, raced.order.orderId, AGE_PAST_DRAFT_WINDOW_HOURS);
    await ageOrder(shop, behind.order.orderId, AGE_PAST_DRAFT_WINDOW_HOURS);

    const job = buildAutoCancelPlacedJob(jobWhoseRowFails(raced.order.orderId, rowRacedError()));
    await runPass(job, world.organizationA);

    expect((await orderRow(shop, raced.order.orderId)).status).toBe("PLACED");
    expect((await orderRow(shop, behind.order.orderId)).status).toBe("CANCELLED");
    // The raced order keeps its reservation; the cancelled one behind it gave its stock back.
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });
  });

  it("logs a row that fails for another reason and still cancels the order behind it", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.placedAutoCancelHours", AUTO_CANCEL_AFTER_HOURS);
    const pack = await shelfOf(shop);
    const broken = await placedOrderOf(shop, pack);
    const behind = await placedOrderOf(shop, pack, KARIM_PHONE);
    await ageOrder(shop, broken.order.orderId, AGE_PAST_DRAFT_WINDOW_HOURS);
    await ageOrder(shop, behind.order.orderId, AGE_PAST_DRAFT_WINDOW_HOURS);

    const job = buildAutoCancelPlacedJob(
      jobWhoseRowFails(broken.order.orderId, new Error("the ledger refused the write")),
    );
    await runPass(job, world.organizationA);

    expect((await orderRow(shop, broken.order.orderId)).status).toBe("PLACED");
    expect((await orderRow(shop, behind.order.orderId)).status).toBe("CANCELLED");
  });
  it("auto-cancels a paid order once on catch-up and credits 500 at a fixed early-Dhaka clock", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.placedAutoCancelHours", AUTO_CANCEL_AFTER_HOURS);
    const pack = await shelfOf(shop);
    const placed = await placedOrderOf(shop, pack);
    const orderId = placed.order.orderId;
    const paid = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: shop.locationId,
        method: "CASH",
        amount: { amount: 500, currency: placed.order.totals.grandTotal.currency },
        allocations: [
          {
            requestType: "ORDER",
            requestId: orderId,
            amount: { amount: 500, currency: placed.order.totals.grandTotal.currency },
          },
        ],
      },
    });
    expect(paid.status).toBe(201);
    const now = new Date("2026-11-01T20:30:00.000Z");
    await harness.connections.tenantShared.collection("orders").updateOne(
      { organizationId: shop.organizationId, orderId },
      {
        $set: {
          createdAt: new Date(now.getTime() - AGE_PAST_DRAFT_WINDOW_HOURS * MILLISECONDS_PER_HOUR),
        },
      },
    );
    const dependencies = { ...jobDependenciesOf(), clock: { now: () => now } };
    const job = buildAutoCancelPlacedJob(dependencies);
    for (const pass of [now, new Date(now.getTime() + MILLISECONDS_PER_HOUR)]) {
      await runInOrganizationContext(shop.organizationId, () =>
        job.run(asId<OrganizationId>(shop.organizationId), pass),
      );
    }
    expect((await orderRow(shop, orderId)).status).toBe("CANCELLED");
    const credits = await harness.connections.tenantShared
      .collection("store_credit_entries")
      .find({ organizationId: shop.organizationId, kind: "CANCELLATION" })
      .toArray();
    expect(credits).toHaveLength(1);
    expect(credits[0]?.["amount"].amount).toBe(500);
    const refund = await harness.connections.tenantShared
      .collection("payments")
      .findOne({ organizationId: shop.organizationId, direction: "REFUND" });
    expect(refund?.["businessDate"]).toBe("2026-11-02");
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 0,
    });
  });
});
