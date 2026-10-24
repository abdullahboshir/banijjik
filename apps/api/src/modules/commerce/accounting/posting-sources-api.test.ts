import { EVENT_TYPE } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  REVENUE_STATE,
  SYSTEM_ACCOUNT_CODE,
} from "@banijjik/contracts/accounting";
import { INVENTORY_EVENT_TYPE, STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { models, MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  completeOrder,
  draftOrder,
  placeOrder,
  publishOffering,
  shopOf,
  type SalesShop,
} from "../../../test-support/sales-api-world.js";
import { buildOrganizationCurrencyReader } from "../../core/organization/index.js";
import {
  buildInventoryPostingSourceAdapter,
  buildStockPostingSourceAdapter,
} from "../inventory/index.js";
import {
  buildPaymentPostingSourceAdapter,
  buildRequestAdvanceReader,
  MongoPaymentSummaryRepository,
} from "../payment/index.js";
import { buildPaymentRequestReaders } from "../../../routes/payment-request-readers.js";
import { buildOrderPostingSourceAdapter, buildOrderRepository } from "../sales/index.js";
import {
  buildPostOrdersHandler,
  buildPostPaymentsHandler,
  buildPostStockHandler,
  MongoAccountRepository,
  MongoJournalRepository,
  seedSystemAccounts,
} from "./index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const DHAKA_02_00 = new Date("2026-10-23T20:00:00Z");
const LOCAL_BUSINESS_DATE = "2026-10-24";
const UTC_BUSINESS_DATE = "2026-10-23";
const SUMMARY_SENTINEL = new Date("2000-01-01T00:00:00Z");

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function postingDependencies() {
  return {
    accounts: new MongoAccountRepository(),
    journals: new MongoJournalRepository(),
    events: kernelEventPublisher,
    audit: { record: async () => undefined },
    clock: harness.clock,
  };
}

async function seedAccounts(organizationId: string): Promise<void> {
  await withOrganizationContext(organizationId, () =>
    seedSystemAccounts(
      { accounts: new MongoAccountRepository(), clock: harness.clock },
      { organizationId: asId<OrganizationId>(organizationId), actorUserId: null },
    ),
  );
}

async function runOrderPosting(shop: SalesShop, orderId: string): Promise<void> {
  const handler = buildPostOrdersHandler({
    orders: buildOrderPostingSourceAdapter({
      orders: buildOrderRepository(),
      advances: buildRequestAdvanceReader(),
      inventory: buildInventoryPostingSourceAdapter(),
    }),
    posting: postingDependencies(),
  });
  await withOrganizationContext(shop.organizationId, () =>
    new MongoUnitOfWork().run(() =>
      handler.handle({
        eventId: newId(),
        type: EVENT_TYPE.ORDER_COMPLETED,
        version: 1,
        occurredAt: harness.clock.now().toISOString(),
        organizationId: shop.organizationId,
        actorUserId: null,
        payload: { orderId },
      }),
    ),
  );
}

async function runPaymentPosting(shop: SalesShop, paymentId: string): Promise<void> {
  const handler = buildPostPaymentsHandler({
    payments: buildPaymentPostingSourceAdapter(buildPaymentRequestReaders()),
    posting: postingDependencies(),
  });
  await withOrganizationContext(shop.organizationId, () =>
    new MongoUnitOfWork().run(() =>
      handler.handle({
        eventId: newId(),
        type: EVENT_TYPE.PAYMENT_RECEIVED,
        version: 1,
        occurredAt: harness.clock.now().toISOString(),
        organizationId: shop.organizationId,
        actorUserId: null,
        payload: { paymentId },
      }),
    ),
  );
}

async function runStockPosting(shop: SalesShop, sourceId: string): Promise<void> {
  const handler = buildPostStockHandler({
    stocks: buildStockPostingSourceAdapter({ currencies: buildOrganizationCurrencyReader() }),
    posting: postingDependencies(),
  });
  await withOrganizationContext(shop.organizationId, () =>
    new MongoUnitOfWork().run(() =>
      handler.handle({
        eventId: newId(),
        type: INVENTORY_EVENT_TYPE.STOCK_SOURCE_RECORDED,
        version: 1,
        occurredAt: harness.clock.now().toISOString(),
        organizationId: shop.organizationId,
        actorUserId: null,
        payload: { sourceType: STOCK_SOURCE_TYPE.STOCK_RECEIPT, sourceId },
      }),
    ),
  );
}

function pay(shop: SalesShop, orderId: string, amount: number) {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/payments`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      method: "CASH",
      amount: { amount, currency: "BDT" },
      allocations: [
        {
          requestType: "ORDER",
          requestId: orderId,
          amount: { amount, currency: "BDT" },
        },
      ],
    },
  });
}

async function failIfPaymentFinishedFirst(request: ReturnType<typeof pay>): Promise<never> {
  const response = await request;
  throw new Error(
    `payment finished before gating: ${response.status} ${JSON.stringify(response.body)}`,
  );
}

interface SummaryRow {
  readonly updatedAt: Date;
  readonly total: { readonly amount: number };
}

async function readSummary(organizationId: string, orderId: string): Promise<SummaryRow> {
  const row = await harness.connections.tenantShared
    .collection("payment_summaries")
    .findOne({ organizationId, requestType: "ORDER", requestId: orderId });
  if (row === null) throw new Error("expected a payment summary");
  return row as unknown as SummaryRow;
}

async function setSummaryUpdatedAt(
  organizationId: string,
  orderId: string,
  updatedAt: Date,
): Promise<void> {
  await harness.connections.tenantShared
    .collection("payment_summaries")
    .updateOne(
      { organizationId, requestType: "ORDER", requestId: orderId },
      { $set: { updatedAt } },
    );
}

describe("posting sources through the real order, payment and stock paths", () => {
  it("a payment paused after reading CONFIRMED conflicts with completion; its advance is in the settle", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await seedAccounts(shop.organizationId);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Tea",
      priceAmount: 1000,
    });
    const contactId = await addCustomer(shop, "Rahim", "+8801700000001");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [{ ...product, quantity: 1 }],
    });
    const placed = await placeOrder(shop, draft);
    expect(placed.status).toBe(200);
    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });
    expect(confirmed.status).toBe("CONFIRMED");
    await setSummaryUpdatedAt(shop.organizationId, draft.orderId, SUMMARY_SENTINEL);

    const originalApplyAllocation = MongoPaymentSummaryRepository.prototype.applyAllocation;
    let releasePayment!: () => void;
    const paymentMayWrite = new Promise<void>((resolve) => {
      releasePayment = resolve;
    });
    let signalPaused!: () => void;
    const paymentPaused = new Promise<void>((resolve) => {
      signalPaused = resolve;
    });
    let gated = false;
    const spy = vi
      .spyOn(MongoPaymentSummaryRepository.prototype, "applyAllocation")
      .mockImplementation(async function (
        this: MongoPaymentSummaryRepository,
        input: Parameters<MongoPaymentSummaryRepository["applyAllocation"]>[0],
      ) {
        if (!gated) {
          gated = true;
          signalPaused();
          await paymentMayWrite;
        }
        return originalApplyAllocation.call(this, input);
      });

    let paymentRequest: ReturnType<typeof pay> | undefined;
    try {
      paymentRequest = pay(shop, draft.orderId, 300);
      await Promise.race([
        paymentPaused,
        failIfPaymentFinishedFirst(paymentRequest),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("payment never reached applyAllocation")), 10_000),
        ),
      ]);

      const beforeCompletion = await readSummary(shop.organizationId, draft.orderId);
      expect(beforeCompletion.updatedAt).toEqual(SUMMARY_SENTINEL);

      const completed = await completeOrder(shop, {
        orderId: draft.orderId,
        version: confirmed.version,
      });
      expect(completed.status).toBe("COMPLETED");

      const afterCompletion = await readSummary(shop.organizationId, draft.orderId);
      expect(afterCompletion.total.amount).toBe(1000);
      expect(afterCompletion.updatedAt.getTime()).toBeGreaterThan(SUMMARY_SENTINEL.getTime());

      releasePayment();
      const paid = await paymentRequest;
      expect(paid.status).toBe(201);
      const revenueState = paid.body.data.allocations[0]?.revenueState as string | undefined;
      const paymentId = paid.body.data.paymentId as string;

      await runPaymentPosting(shop, paymentId);

      await runOrderPosting(shop, draft.orderId);

      const settle = await withOrganizationContext(shop.organizationId, () =>
        new MongoJournalRepository().findBySource({
          sourceType: JOURNAL_SOURCE_TYPE.ORDER,
          sourceId: draft.orderId,
          postingKey: POSTING_KEY.order_advance_settle,
        }),
      );
      const settledAdvance =
        settle?.lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)
          ?.debit.amount ?? 0;
      // The payment was written while the order was CONFIRMED, so it stays an advance and the
      // settle entry moves exactly that advance; the two never both count the 300.
      expect(revenueState).toBe(REVENUE_STATE.BEFORE_REVENUE);
      expect(settledAdvance).toBe(300);
      const advanceReceived = await withOrganizationContext(shop.organizationId, () =>
        new MongoJournalRepository().findBySource({
          sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
          sourceId: paymentId,
          postingKey: POSTING_KEY.payment_in_advance,
        }),
      );
      const advanceCredited =
        advanceReceived?.lines.find(
          (line) => line.accountCode === SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES,
        )?.credit.amount ?? 0;
      expect(advanceCredited - settledAdvance).toBe(0);
    } finally {
      releasePayment();
      spy.mockRestore();
      if (paymentRequest !== undefined) await paymentRequest.catch(() => undefined);
    }
  });

  it("order revenue posts the organization local business date when completed at 02:00 Dhaka", async () => {
    harness.clock.setNow(DHAKA_02_00);
    const shop = shopOf(await worldFor(harness, RETAIL));
    await seedAccounts(shop.organizationId);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Rice",
      priceAmount: 500,
    });
    const contactId = await addCustomer(shop, "Karim", "+8801700000002");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [{ ...product, quantity: 1 }],
    });
    expect(draft.businessDate).toBe(LOCAL_BUSINESS_DATE);
    const placed = await placeOrder(shop, draft);
    expect(placed.status).toBe(200);
    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });

    const completed = await completeOrder(shop, {
      orderId: draft.orderId,
      version: confirmed.version,
    });
    expect(completed.status).toBe("COMPLETED");

    await runOrderPosting(shop, draft.orderId);

    const revenue = await withOrganizationContext(shop.organizationId, () =>
      new MongoJournalRepository().findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: draft.orderId,
        postingKey: POSTING_KEY.order_revenue,
      }),
    );
    expect(revenue?.businessDate).toBe(LOCAL_BUSINESS_DATE);
  });

  it("stock receipt posts the organization local business date when received at 02:00 Dhaka", async () => {
    harness.clock.setNow(DHAKA_02_00);
    const shop = shopOf(await worldFor(harness, RETAIL));
    await seedAccounts(shop.organizationId);
    const inventoryItemId = await addInventoryItem(shop, "Lentils");

    const received = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/stock/receipts`,
      idempotencyKey: newId(),
      body: {
        locationId: shop.locationId,
        paidVia: "CASH",
        lines: [
          {
            inventoryItemId,
            quantity: 1500,
            unitCost: { amount: 5000, currency: "BDT" },
          },
        ],
      },
    });
    expect(received.status).toBe(201);
    const sourceId = received.body.data.sourceId as string;

    await runStockPosting(shop, sourceId);

    const receipt = await withOrganizationContext(shop.organizationId, () =>
      new MongoJournalRepository().findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.STOCK,
        sourceId,
        postingKey: POSTING_KEY.stock_receipt,
      }),
    );
    expect(receipt?.businessDate).toBe(LOCAL_BUSINESS_DATE);
  });

  it("stock receipt in a UTC organization posts the UTC date, not the Dhaka date, at 02:00 Dhaka", async () => {
    harness.clock.setNow(DHAKA_02_00);
    const shop = shopOf(await worldFor(harness, RETAIL));
    await seedAccounts(shop.organizationId);
    const organizationId = asId<OrganizationId>(shop.organizationId);
    await withOrganizationContext(shop.organizationId, async () => {
      await models({})
        .get("Organization")
        .updateOne({ organizationId }, { $set: { timezone: "UTC" } });
    });
    const inventoryItemId = await addInventoryItem(shop, "Chickpeas");

    const received = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/stock/receipts`,
      idempotencyKey: newId(),
      body: {
        locationId: shop.locationId,
        paidVia: "CASH",
        lines: [{ inventoryItemId, quantity: 100, unitCost: { amount: 2000, currency: "BDT" } }],
      },
    });
    expect(received.status).toBe(201);
    const sourceId = received.body.data.sourceId as string;

    await runStockPosting(shop, sourceId);

    const movements = await withOrganizationContext(shop.organizationId, () =>
      buildInventoryPostingSourceAdapter().readMovements({ organizationId, sourceId }),
    );
    expect(movements[0]?.businessDate).toBe(UTC_BUSINESS_DATE);
    const receipt = await withOrganizationContext(shop.organizationId, () =>
      new MongoJournalRepository().findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.STOCK,
        sourceId,
        postingKey: POSTING_KEY.stock_receipt,
      }),
    );
    expect(receipt?.businessDate).toBe(UTC_BUSINESS_DATE);
  });
});
