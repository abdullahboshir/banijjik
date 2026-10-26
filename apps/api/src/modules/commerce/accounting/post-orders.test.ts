import { EVENT_TYPE } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, models, withTransaction } from "../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../kernel/db/index.js";
import { EventHandlerRegistry } from "../../../kernel/events/event-handler-registry.js";
import { runEventHandler } from "../../../kernel/events/handler-runner.js";
import { publishEvent } from "../../../kernel/events/publish-event.js";
import { registerEventModels } from "../../../kernel/events/register-event-models.js";
import { registerSequenceModel } from "../../../kernel/sequence/index.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../test-support/test-databases.js";
import { buildPostOrdersHandler } from "./application/handlers/post-orders.handler.js";
import type { OrderPostingSource } from "./application/ports/order-posting-source.js";
import type { PostJournalDependencies } from "./application/post-journal.js";
import { seedSystemAccounts } from "./application/seed-system-accounts.js";
import { GetTrialBalanceUseCase } from "./application/use-cases/get-trial-balance.use-case.js";
import type { OrderPostingSnapshot } from "./domain/order-posting-rules.js";
import { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
import { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";
import { registerAccountingModels } from "./infrastructure/register-accounting-models.js";

registerAccountingModels();
registerSequenceModel();
registerEventModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

const NOW = new Date("2026-10-24T10:00:00Z");
const BUSINESS_DATE = "2026-10-24";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

interface Scene {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly orders: Map<string, OrderPostingSnapshot>;
  readonly handler: ReturnType<typeof buildPostOrdersHandler>;
  readonly accounts: MongoAccountRepository;
  readonly journals: MongoJournalRepository;
  readonly trialBalance: GetTrialBalanceUseCase;
}

async function newScene(): Promise<Scene> {
  const organizationId = asId<OrganizationId>(newId());
  const orders = new Map<string, OrderPostingSnapshot>();
  const orderSource: OrderPostingSource = {
    readOrder: async (orderId) => orders.get(orderId),
  };
  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  const posting: PostJournalDependencies = {
    accounts,
    journals,
    events: { publish: async () => undefined },
    audit: { record: async () => undefined },
    clock: { now: () => NOW },
  };
  await withOrganizationContext(organizationId, () =>
    seedSystemAccounts(
      { accounts, clock: { now: () => NOW } },
      { organizationId, actorUserId: null },
    ),
  );
  const trialBalance = new GetTrialBalanceUseCase(accounts, journals, {
    read: async () => "BDT",
  });
  return {
    organizationId,
    locationId: newId(),
    orders,
    handler: buildPostOrdersHandler({ orders: orderSource, posting }),
    accounts,
    journals,
    trialBalance,
  };
}

function envelopeOf(scene: Scene, orderId: string) {
  return {
    eventId: newId(),
    type: EVENT_TYPE.ORDER_COMPLETED,
    version: 1,
    occurredAt: NOW.toISOString(),
    organizationId: scene.organizationId,
    actorUserId: null,
    payload: { orderId },
  } as const;
}

function handleEvent(scene: Scene, orderId: string) {
  return withOrganizationContext(scene.organizationId, () =>
    withTransaction(() => scene.handler.handle(envelopeOf(scene, orderId))),
  );
}

describe("accounting postOrders handler", () => {
  it("Completed PICKUP order and instant sale each post revenue, tax, discount and rounding lines that balance; tax-exclusive and tax-inclusive orders", async () => {
    const scene = await newScene();

    // 1. Completed PICKUP order (tax-exclusive)
    const pickupOrderId = newId();
    scene.orders.set(pickupOrderId, {
      orderId: pickupOrderId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(1000),
        discountTotal: bdt(100),
        taxTotal: bdt(50),
        deliveryCharge: bdt(0),
        grandTotal: bdt(950),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(0),
      serviceGoods: bdt(0),
      cogs: bdt(0),
    });

    await handleEvent(scene, pickupOrderId);

    const pickupEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: pickupOrderId,
        postingKey: POSTING_KEY.order_revenue,
      }),
    );
    expect(pickupEntry).toBeDefined();
    expect(pickupEntry?.lines).toHaveLength(4);

    // 2. Instant sale (tax-inclusive with rounding)
    const instantOrderId = newId();
    scene.orders.set(instantOrderId, {
      orderId: instantOrderId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(1000),
        discountTotal: bdt(50),
        taxTotal: bdt(100),
        deliveryCharge: bdt(0),
        grandTotal: bdt(950),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(0),
      serviceGoods: bdt(0),
      cogs: bdt(0),
    });

    await handleEvent(scene, instantOrderId);

    const instantEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: instantOrderId,
        postingKey: POSTING_KEY.order_revenue,
      }),
    );
    expect(instantEntry).toBeDefined();

    // Check trial balance balances
    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);
    expect(tb.debitTotal.amount).toBe(tb.creditTotal.amount);
  });

  it("An order with 300 paid before completion posts a 300 advance settle; one paid only after completion posts none", async () => {
    const scene = await newScene();

    // Order with 300 advance held
    const orderWithAdvance = newId();
    scene.orders.set(orderWithAdvance, {
      orderId: orderWithAdvance,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(500),
        discountTotal: bdt(0),
        taxTotal: bdt(0),
        deliveryCharge: bdt(0),
        grandTotal: bdt(500),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(300),
      serviceGoods: bdt(0),
      cogs: bdt(0),
    });

    await handleEvent(scene, orderWithAdvance);

    const settleEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderWithAdvance,
        postingKey: POSTING_KEY.order_advance_settle,
      }),
    );
    expect(settleEntry).toBeDefined();
    expect(settleEntry?.lines).toEqual([
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES,
        debit: bdt(300),
        credit: bdt(0),
      }),
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE,
        debit: bdt(0),
        credit: bdt(300),
      }),
    ]);

    // Order with no advance held (paid after completion)
    const orderNoAdvance = newId();
    scene.orders.set(orderNoAdvance, {
      orderId: orderNoAdvance,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(500),
        discountTotal: bdt(0),
        taxTotal: bdt(0),
        deliveryCharge: bdt(0),
        grandTotal: bdt(500),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(0),
      serviceGoods: bdt(0),
      cogs: bdt(0),
    });

    await handleEvent(scene, orderNoAdvance);

    const noSettleEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderNoAdvance,
        postingKey: POSTING_KEY.order_advance_settle,
      }),
    );
    expect(noSettleEntry).toBeUndefined();
  });

  it("COGS equals the SALE movements value; the trial balance after receive 10 @ 50 and sell 4 shows INVENTORY 300 and COGS 200", async () => {
    const scene = await newScene();

    // Directly seed INVENTORY debit 500 (10 @ 50) and CASH credit 500
    // so we can test the sell 4 COGS effect on trial balance
    const accounts = scene.accounts;
    const invAccount = await withOrganizationContext(scene.organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.INVENTORY),
    );
    const cashAccount = await withOrganizationContext(scene.organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.CASH),
    );
    expect(invAccount).toBeDefined();
    expect(cashAccount).toBeDefined();

    // Order selling 4 @ 50 cost = 200 COGS
    const orderId = newId();
    scene.orders.set(orderId, {
      orderId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(400),
        discountTotal: bdt(0),
        taxTotal: bdt(0),
        deliveryCharge: bdt(0),
        grandTotal: bdt(400),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(0),
      serviceGoods: bdt(0),
      cogs: bdt(200),
    });

    // Simulate stock receipt journal entry: Dr INVENTORY 500, Cr CASH 500
    const posting: PostJournalDependencies = {
      accounts: scene.accounts,
      journals: scene.journals,
      events: { publish: async () => undefined },
      audit: { record: async () => undefined },
      clock: { now: () => NOW },
    };
    const { postJournalEntry } = await import("./application/post-journal.js");
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        postJournalEntry(posting, {
          organizationId: scene.organizationId,
          actorUserId: null,
          draft: {
            businessDate: BUSINESS_DATE,
            locationId: scene.locationId,
            sourceType: JOURNAL_SOURCE_TYPE.STOCK,
            sourceId: "receipt-init",
            postingKey: POSTING_KEY.stock_receipt,
            lines: [
              { accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: bdt(500), credit: bdt(0) },
              { accountCode: SYSTEM_ACCOUNT_CODE.CASH, debit: bdt(0), credit: bdt(500) },
            ],
          },
        }),
      ),
    );

    // Complete order -> posts revenue and COGS
    await handleEvent(scene, orderId);

    const cogsEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderId,
        postingKey: POSTING_KEY.order_cost,
      }),
    );
    expect(cogsEntry).toBeDefined();
    expect(cogsEntry?.lines).toEqual([
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.COGS,
        debit: bdt(200),
        credit: bdt(0),
      }),
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY,
        debit: bdt(0),
        credit: bdt(200),
      }),
    ]);

    // Trial balance check: INVENTORY has 500 Dr - 200 Cr = 300 balance; COGS has 200 balance
    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);

    const invRow = tb.accounts.find((a) => a.accountCode === SYSTEM_ACCOUNT_CODE.INVENTORY);
    const cogsRow = tb.accounts.find((a) => a.accountCode === SYSTEM_ACCOUNT_CODE.COGS);
    expect(invRow?.balance.amount).toBe(300);
    expect(cogsRow?.balance.amount).toBe(200);
  });

  it("Every handler run twice posts once; an ORDERED order stream with placed -> confirmed -> completed posts", async () => {
    const scene = await newScene();
    const orderId = newId();
    scene.orders.set(orderId, {
      orderId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(300),
        discountTotal: bdt(0),
        taxTotal: bdt(0),
        deliveryCharge: bdt(0),
        grandTotal: bdt(300),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(100),
      serviceGoods: bdt(0),
      cogs: bdt(150),
    });

    await handleEvent(scene, orderId);
    // Run second time (idempotent replay)
    await handleEvent(scene, orderId);

    const entries = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.list({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        page: 1,
        limit: 10,
      }),
    );
    // 3 entries: revenue, advance settle, cost. Exactly 3, no duplicates!
    expect(entries.items.length).toBe(3);
  });

  it("ORDERED order stream with placed -> confirmed -> completed posts; module off skips posting", async () => {
    const scene = await newScene();
    const orderId = newId();
    scene.orders.set(orderId, {
      orderId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(500),
        discountTotal: bdt(0),
        taxTotal: bdt(0),
        deliveryCharge: bdt(0),
        grandTotal: bdt(500),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(0),
      serviceGoods: bdt(0),
      cogs: bdt(0),
    });

    const registry = new EventHandlerRegistry();
    registry.register(scene.handler);

    const orderingKey = `order:${orderId}`;

    // 1. Publish placed event (sequence 1)
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() => publishEvent(EVENT_TYPE.ORDER_PLACED, { orderId }, { orderingKey })),
    );

    // 2. Publish confirmed event (sequence 2)
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() => publishEvent(EVENT_TYPE.ORDER_CONFIRMED, { orderId }, { orderingKey })),
    );

    // 3. Publish completed event (sequence 3)
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() => publishEvent(EVENT_TYPE.ORDER_COMPLETED, { orderId }, { orderingKey })),
    );

    const { OUTBOX_EVENT_MODEL_NAME } =
      await import("../../../kernel/events/outbox-event.schema.js");
    type OutboxDoc = { eventId: string; type: (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE] };
    const Outbox = models({}).get(OUTBOX_EVENT_MODEL_NAME);
    const placed = (await Outbox.findOne({
      organizationId: scene.organizationId,
      orderingKey,
      type: EVENT_TYPE.ORDER_PLACED,
    }).lean()) as unknown as OutboxDoc | null;
    const confirmed = (await Outbox.findOne({
      organizationId: scene.organizationId,
      orderingKey,
      type: EVENT_TYPE.ORDER_CONFIRMED,
    }).lean()) as unknown as OutboxDoc | null;
    const completed = (await Outbox.findOne({
      organizationId: scene.organizationId,
      orderingKey,
      type: EVENT_TYPE.ORDER_COMPLETED,
    }).lean()) as unknown as OutboxDoc | null;

    expect(placed).toBeDefined();
    expect(confirmed).toBeDefined();
    expect(completed).toBeDefined();
    if (!placed || !confirmed || !completed) throw new Error("expected outbox events");

    const handlerKey = scene.handler.handlerKey;

    // Run placed: handler does not handle placed -> SKIPPED_NOT_HANDLED, stream advances
    const r1 = await runEventHandler(
      {
        eventId: placed.eventId,
        handlerKey,
        type: placed.type,
        organizationId: scene.organizationId,
      },
      registry,
      { isEffective: async () => true },
    );
    expect(r1).toBe("SKIPPED_NOT_HANDLED");

    // Run confirmed -> SKIPPED_NOT_HANDLED, stream advances
    const r2 = await runEventHandler(
      {
        eventId: confirmed.eventId,
        handlerKey,
        type: confirmed.type,
        organizationId: scene.organizationId,
      },
      registry,
      { isEffective: async () => true },
    );
    expect(r2).toBe("SKIPPED_NOT_HANDLED");

    // Module off test: with isEffective returning false, completed is skipped
    const r3Off = await runEventHandler(
      {
        eventId: completed.eventId,
        handlerKey,
        type: completed.type,
        organizationId: scene.organizationId,
      },
      registry,
      { isEffective: async () => false },
    );
    expect(r3Off).toBe("SKIPPED_MODULE_OFF");

    const noEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: orderId,
        postingKey: POSTING_KEY.order_revenue,
      }),
    );
    expect(noEntry).toBeUndefined();

    // Now test with module ON for another order: HANDLED, posting succeeds
    const onOrderId = newId();
    scene.orders.set(onOrderId, {
      orderId: onOrderId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      totals: {
        subtotal: bdt(500),
        discountTotal: bdt(0),
        taxTotal: bdt(0),
        deliveryCharge: bdt(0),
        grandTotal: bdt(500),
        roundingAdjustment: bdt(0),
      },
      advancesToSettle: bdt(0),
      serviceGoods: bdt(0),
      cogs: bdt(0),
    });

    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        publishEvent(
          EVENT_TYPE.ORDER_COMPLETED,
          { orderId: onOrderId },
          { orderingKey: `order:${onOrderId}` },
        ),
      ),
    );

    const onCompleted = (await Outbox.findOne({
      organizationId: scene.organizationId,
      orderingKey: `order:${onOrderId}`,
      type: EVENT_TYPE.ORDER_COMPLETED,
    }).lean()) as unknown as OutboxDoc | null;

    if (!onCompleted) throw new Error("expected onCompleted outbox event");

    const rOn = await runEventHandler(
      {
        eventId: onCompleted.eventId,
        handlerKey,
        type: onCompleted.type,
        organizationId: scene.organizationId,
      },
      registry,
      { isEffective: async () => true },
    );
    expect(rOn).toBe("HANDLED");

    const revEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.ORDER,
        sourceId: onOrderId,
        postingKey: POSTING_KEY.order_revenue,
      }),
    );
    expect(revEntry).toBeDefined();
  });
});
