import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/accounting";
import { BOOKING_STATUS, type BookingStatus } from "@banijjik/contracts/booking";
import {
  COMMISSION_CALCULATION,
  COMMISSION_ENTRY_KIND,
  COMMISSION_SOURCE_TYPE,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { PAYMENT_REQUEST_TYPE, type PaymentRequestType } from "@banijjik/contracts/payment";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import {
  asId,
  newId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type RoleId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoUnitOfWork, initializeModels, withTransaction } from "../../../kernel/db/index.js";
import { EventHandlerRegistry } from "../../../kernel/events/event-handler-registry.js";
import { runEventHandler } from "../../../kernel/events/handler-runner.js";
import { publishEvent } from "../../../kernel/events/publish-event.js";
import { registerEventModels } from "../../../kernel/events/register-event-models.js";
import { outboxModel } from "../../../test-support/event-fixtures.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../test-support/test-databases.js";
import type { DatabaseConnections } from "../../../kernel/db/index.js";
import { CommissionRule } from "./domain/commission-rule.entity.js";
import { MongoCommissionEntryRepository } from "./infrastructure/mongo-commission-entry.repository.js";
import { MongoCommissionRuleRepository } from "./infrastructure/mongo-commission-rule.repository.js";
import { MongoCommissionSourceMarkRepository } from "./infrastructure/mongo-commission-source-mark.repository.js";
import { registerCommissionModels } from "./infrastructure/register-commission-models.js";
import {
  accrueCompletedBooking,
  accrueCompletedOrder,
  type AccrualDependencies,
  type CommissionEventContext,
} from "./application/accrue-commission.js";
import { buildAccrueCommissionHandler } from "./application/handlers/accrue-commission.handler.js";
import type {
  BookingCommissionFacts,
  OrderCommissionFacts,
} from "./application/ports/commission-ports.js";

registerEventModels();
registerCommissionModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

const GROSS = 115_000;
const TAX = 15_000;
const BASE = GROSS - TAX;
const TEN_PERCENT = 1000;
/** 02:00 on 23 October in Dhaka, which is still 22 October in UTC. */
const COMPLETED_AT = new Date("2026-10-22T20:00:00Z");
const DHAKA_DATE = "2026-10-23";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

interface Scene {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly memberId: MemberId;
  readonly offeringId: OfferingId;
  readonly dependencies: AccrualDependencies;
  readonly published: { type: string; payload: object; orderingKey: string }[];
  readonly bookings: Map<string, BookingCommissionFacts>;
  readonly orders: Map<string, OrderCommissionFacts>;
  readonly refunded: Map<string, Money>;
  readonly allocations: Map<string, { requestType: PaymentRequestType; requestId: string }[]>;
  readonly warn: ReturnType<typeof vi.fn>;
}

function newScene(): Scene {
  const organizationId = asId<OrganizationId>(newId());
  const memberId = asId<MemberId>(newId());
  const offeringId = asId<OfferingId>(newId());
  const locationId = newId();
  const published: Scene["published"] = [];
  const bookings = new Map<string, BookingCommissionFacts>();
  const orders = new Map<string, OrderCommissionFacts>();
  const refunded = new Map<string, Money>();
  const allocations: Scene["allocations"] = new Map();
  const warn = vi.fn();
  const dependencies: AccrualDependencies = {
    rules: new MongoCommissionRuleRepository(),
    entries: new MongoCommissionEntryRepository(),
    marks: new MongoCommissionSourceMarkRepository(),
    bookings: { readBooking: async (bookingId) => bookings.get(bookingId) },
    orders: { readOrder: async (orderId) => orders.get(orderId) },
    payments: {
      readAllocations: async (paymentId) => allocations.get(paymentId) ?? [],
      readRefunded: async (_requestType, requestId) => refunded.get(requestId),
    },
    offerings: { readOffering: async () => ({ kind: "SERVICE", categoryIds: [] }) },
    memberRoles: { roleIdsAt: async () => [] },
    timezones: { read: async () => "Asia/Dhaka" },
    events: {
      publish: async (type, payload, options) => {
        published.push({ type, payload, orderingKey: options.orderingKey });
      },
    },
    unitOfWork: new MongoUnitOfWork(),
    clock: { now: () => new Date("2026-10-23T10:00:00Z") },
    logger: { debug: vi.fn(), warn },
  };
  return {
    organizationId,
    locationId,
    memberId,
    offeringId,
    dependencies,
    published,
    bookings,
    orders,
    refunded,
    allocations,
    warn,
  };
}

function addBooking(scene: Scene, overrides: Partial<BookingCommissionFacts> = {}): string {
  const bookingId = newId();
  scene.bookings.set(bookingId, {
    bookingId,
    bookingNumber: "000042",
    locationId: scene.locationId,
    providerMemberId: scene.memberId,
    offeringId: scene.offeringId,
    quantity: 1,
    status: BOOKING_STATUS.COMPLETED as BookingStatus,
    price: { unitPrice: bdt(GROSS), total: bdt(GROSS), tax: bdt(TAX), currency: "BDT" },
    ...overrides,
  });
  return bookingId;
}

async function addMemberRule(
  scene: Scene,
  fields: { percentBasisPoints?: number | null; fixedAmount?: Money | null } = {},
): Promise<CommissionRule> {
  const isFixed = fields.fixedAmount !== undefined && fields.fixedAmount !== null;
  const rule = CommissionRule.create({
    organizationId: scene.organizationId,
    subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
    memberId: scene.memberId,
    roleId: null as RoleId | null,
    targetType: COMMISSION_TARGET_TYPE.ALL,
    offeringKind: null,
    categoryId: null,
    offeringId: null,
    calculation: isFixed ? COMMISSION_CALCULATION.FIXED : COMMISSION_CALCULATION.PERCENT,
    percentBasisPoints: isFixed ? null : (fields.percentBasisPoints ?? TEN_PERCENT),
    fixedAmount: fields.fixedAmount ?? null,
    now: new Date("2026-10-01T00:00:00Z"),
    actorUserId: null,
  });
  await new MongoCommissionRuleRepository().insert(rule);
  return rule;
}

type HandlerInput = EventEnvelope<{ bookingId: string }>;

function completedEnvelope(scene: Scene, bookingId: string): HandlerInput {
  return envelope(scene, EVENT_TYPE.BOOKING_COMPLETED, { bookingId });
}

function paymentEnvelope(
  scene: Scene,
  type: typeof EVENT_TYPE.PAYMENT_REFUNDED | typeof EVENT_TYPE.PAYMENT_REVERSED,
  paymentId: string,
): HandlerInput {
  return envelope(scene, type, { paymentId });
}

/**
 * The handler is typed by its main event (booking completed); a payment event has another payload.
 * The real runner reaches it through the untyped registry, so the test widens the type once, here.
 */
function envelope(scene: Scene, type: string, payload: object): HandlerInput {
  const built = {
    eventId: newId(),
    type,
    version: 1,
    occurredAt: COMPLETED_AT.toISOString(),
    organizationId: scene.organizationId,
    actorUserId: null,
    payload,
  };
  return built as unknown as HandlerInput;
}

async function entriesOf(scene: Scene, bookingId: string) {
  return withOrganizationContext(scene.organizationId, () =>
    scene.dependencies.entries.listBySource(COMMISSION_SOURCE_TYPE.BOOKING, bookingId),
  );
}

function runAs<Result>(scene: Scene, work: () => Promise<Result>): Promise<Result> {
  return withOrganizationContext(scene.organizationId, work);
}

function refundOf(scene: Scene, bookingId: string, refundedAmount: number): string {
  scene.refunded.set(bookingId, bdt(refundedAmount));
  const paymentId = newId();
  scene.allocations.set(paymentId, [
    { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: bookingId },
  ]);
  return paymentId;
}

describe("commission accrual on booking completion", () => {
  it("writes one ACCRUAL with the rule snapshot, the base after discount without tax and the organization date", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    const rule = await runAs(scene, () => addMemberRule(scene));

    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));

    const entries = await entriesOf(scene, bookingId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      memberId: scene.memberId,
      sourceId: bookingId,
      sourceNumber: "000042",
      sequence: 1,
      entryKind: COMMISSION_ENTRY_KIND.ACCRUAL,
      amount: bdt(BASE / 10),
      base: bdt(BASE),
      sourceGrossTotal: bdt(GROSS),
      businessDate: DHAKA_DATE,
      payoutId: null,
      ruleSnapshot: {
        commissionRuleId: rule.commissionRuleId,
        calculation: COMMISSION_CALCULATION.PERCENT,
        percentBasisPoints: TEN_PERCENT,
      },
    });
    expect(scene.published).toEqual([
      {
        type: "commission.entry.recorded",
        payload: { commissionEntryId: entries[0]?.commissionEntryId },
        orderingKey: `commission:${scene.memberId}`,
      },
    ]);
  });

  it("writes nothing for a booking without a provider", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene, { providerMemberId: null });
    await runAs(scene, () => addMemberRule(scene));

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(completedEnvelope(scene, bookingId)),
    );

    expect(await entriesOf(scene, bookingId)).toHaveLength(0);
  });

  it("writes nothing when no rule matches", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(completedEnvelope(scene, bookingId)),
    );

    expect(await entriesOf(scene, bookingId)).toHaveLength(0);
    expect(scene.published).toHaveLength(0);
  });

  it("writes nothing for a booking that is not completed", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene, { status: BOOKING_STATUS.CONFIRMED });
    await runAs(scene, () => addMemberRule(scene));

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(completedEnvelope(scene, bookingId)),
    );

    expect(await entriesOf(scene, bookingId)).toHaveLength(0);
  });

  it("skips a fixed rule in another currency, logs it and counts it", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () =>
      addMemberRule(scene, { fixedAmount: { amount: 500, currency: "USD" as Money["currency"] } }),
    );
    const context: CommissionEventContext = {
      organizationId: scene.organizationId,
      actorUserId: null,
      occurredAt: COMPLETED_AT,
    };

    const result = await runAs(scene, () =>
      accrueCompletedBooking(scene.dependencies, { bookingId, context }),
    );

    expect(result).toEqual({ accruals: 0, adjustments: 0, skippedCurrency: 1 });
    expect(scene.warn).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId }),
      "commission.accrual_skipped_currency",
    );
    expect(await entriesOf(scene, bookingId)).toHaveLength(0);
  });

  it("writes one accrual when the same completion is handled twice (replay)", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    const event = completedEnvelope(scene, bookingId);

    await runAs(scene, () => handler.handle(event));
    await runAs(scene, () => handler.handle(event));

    expect(await entriesOf(scene, bookingId)).toHaveLength(1);
    expect(scene.published).toHaveLength(1);
  });
});

describe("commission reconcile after a refund", () => {
  it("writes a REFUND_ADJUSTMENT in proportion, then the next sequence for a second partial refund", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));

    const firstRefund = refundOf(scene, bookingId, GROSS / 2);
    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, firstRefund)),
    );
    const secondRefund = refundOf(scene, bookingId, GROSS);
    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, secondRefund)),
    );

    const entries = await entriesOf(scene, bookingId);
    expect(entries.map((entry) => [entry.sequence, entry.entryKind, entry.amount.amount])).toEqual([
      [1, COMMISSION_ENTRY_KIND.ACCRUAL, 10_000],
      [2, COMMISSION_ENTRY_KIND.REFUND_ADJUSTMENT, -5000],
      [3, COMMISSION_ENTRY_KIND.REFUND_ADJUSTMENT, -5000],
    ]);
    expect(entries.reduce((total, entry) => total + entry.amount.amount, 0)).toBe(0);
    expect(entries[2]?.refundedTotalSeen).toEqual(bdt(GROSS));
  });

  it("restores the commission when the refund is reversed", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));
    const refund = refundOf(scene, bookingId, GROSS / 2);
    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, refund)),
    );

    scene.refunded.set(bookingId, bdt(0));
    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REVERSED, refund)),
    );

    const entries = await entriesOf(scene, bookingId);
    expect(entries.map((entry) => entry.amount.amount)).toEqual([10_000, -5000, 5000]);
  });

  it("gives the same ledger when the refund event is handled before the completion event", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    const refund = refundOf(scene, bookingId, GROSS / 2);

    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, refund)),
    );
    expect(await entriesOf(scene, bookingId)).toHaveLength(0);

    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));

    const entries = await entriesOf(scene, bookingId);
    expect(entries.map((entry) => entry.amount.amount)).toEqual([10_000, -5000]);
  });

  it("ends with one adjustment when two reconciles race for the same booking", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));
    const refund = refundOf(scene, bookingId, GROSS / 2);

    await Promise.all([
      runAs(scene, () =>
        handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, refund)),
      ),
      runAs(scene, () =>
        handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REVERSED, refund)),
      ),
    ]);

    const entries = await entriesOf(scene, bookingId);
    expect(entries.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(entries.reduce((total, entry) => total + entry.amount.amount, 0)).toBe(5000);
  });

  it("reconciles a refund that committed while the completion had already read the summary", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const refund = refundOf(scene, bookingId, 0);
    let releaseCompletion: () => void = () => undefined;
    const completionMayContinue = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });
    let completionHasReadSummary: () => void = () => undefined;
    const summaryRead = new Promise<void>((resolve) => {
      completionHasReadSummary = resolve;
    });
    const pausedCompletion = buildAccrueCommissionHandler({
      ...scene.dependencies,
      payments: {
        ...scene.dependencies.payments,
        // Reads the summary as it is now, then waits: the refund commits after this read.
        readRefunded: async (_requestType, requestId) => {
          const staleSummary = scene.refunded.get(requestId);
          completionHasReadSummary();
          await completionMayContinue;
          return staleSummary;
        },
      },
    });
    const refundHandler = buildAccrueCommissionHandler(scene.dependencies);

    const completion = runAs(scene, () =>
      pausedCompletion.handle(completedEnvelope(scene, bookingId)),
    );
    await summaryRead;
    scene.refunded.set(bookingId, bdt(GROSS / 2));
    const refundRun = runAs(scene, () =>
      refundHandler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, refund)),
    );
    // The refund's transaction collides with the completion on the source marker and retries; the completion then commits.
    await new Promise((resolve) => setTimeout(resolve, 150));
    releaseCompletion();
    await Promise.all([completion, refundRun]);

    const entries = await entriesOf(scene, bookingId);
    expect(entries.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(entries.reduce((total, entry) => total + entry.amount.amount, 0)).toBe(5000);
  });

  it("skips the reconcile and logs when the payment summary is in another currency", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));
    const refund = refundOf(scene, bookingId, GROSS);
    scene.refunded.set(bookingId, { amount: GROSS, currency: "USD" as Money["currency"] });

    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, refund)),
    );

    expect(await entriesOf(scene, bookingId)).toHaveLength(1);
    expect(scene.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: bookingId }),
      "commission.reconcile_skipped_currency",
    );
  });

  it("does nothing for a payment refund that has no booking allocation", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(completedEnvelope(scene, bookingId)));
    scene.refunded.set(bookingId, bdt(GROSS));
    const orderPayment = newId();
    scene.allocations.set(orderPayment, [
      { requestType: PAYMENT_REQUEST_TYPE.ORDER, requestId: newId() },
    ]);

    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, orderPayment)),
    );

    expect(await entriesOf(scene, bookingId)).toHaveLength(1);
  });
});

describe("commission handler when the module is off", () => {
  it("does nothing for an organization whose commission module is off, and accrues when it is on", async () => {
    const scene = newScene();
    const bookingId = addBooking(scene);
    await runAs(scene, () => addMemberRule(scene));
    const registry = new EventHandlerRegistry();
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    registry.register(handler);
    expect(handler.moduleKey).toBe(MODULE_KEY.COMMISSION);

    const publishCompleted = async (): Promise<string> => {
      await runAs(scene, () =>
        withTransaction(() =>
          publishEvent(
            EVENT_TYPE.BOOKING_COMPLETED,
            { bookingId },
            { orderingKey: `booking:${bookingId}` },
          ),
        ),
      );
      const row = await outboxModel()
        .findOne({ "payload.bookingId": bookingId })
        .sort({ createdAt: -1 })
        .lean<{ eventId: string }>();
      if (row === null) throw new Error("the completed event was not written");
      return row.eventId;
    };
    const jobFor = (eventId: string) => ({
      eventId,
      handlerKey: handler.handlerKey,
      type: EVENT_TYPE.BOOKING_COMPLETED,
      organizationId: scene.organizationId,
    });
    const effectiveness = (isOn: boolean) => ({ isEffective: async () => isOn });

    const offResult = await runEventHandler(
      jobFor(await publishCompleted()),
      registry,
      effectiveness(false),
    );
    expect(offResult).toBe("SKIPPED_MODULE_OFF");
    expect(await entriesOf(scene, bookingId)).toHaveLength(0);

    const onResult = await runEventHandler(
      jobFor(await publishCompleted()),
      registry,
      effectiveness(true),
    );
    expect(onResult).toBe("HANDLED");
    expect(await entriesOf(scene, bookingId)).toHaveLength(1);
  });
});

/** Two performed lines of one order; a 10 % member rule gives 10 000 and 5 000 on their bases. */
const ORDER_GROSS = 172_500;
const FIRST_LINE = { net: 115_000, tax: 15_000 };
const SECOND_LINE = { net: 57_500, tax: 7_500 };

interface OrderLineInput {
  readonly memberId: string | null;
  readonly net: number;
  readonly tax: number;
}

function addOrder(scene: Scene, lines: readonly OrderLineInput[], soldQuantity = 1): string {
  const orderId = newId();
  scene.orders.set(orderId, {
    orderId,
    orderNumber: "000077",
    locationId: scene.locationId,
    status: ORDER_STATUS.COMPLETED,
    grandTotal: bdt(ORDER_GROSS),
    lines: lines.map((line) => ({
      orderLineId: newId(),
      offeringId: scene.offeringId,
      quantity: soldQuantity,
      returnedQuantity: 0,
      lineNetTotal: bdt(line.net),
      lineTax: bdt(line.tax),
      performedByMemberId: line.memberId,
    })),
  });
  return orderId;
}

function orderEnvelope(scene: Scene, orderId: string): HandlerInput {
  return envelope(scene, EVENT_TYPE.ORDER_COMPLETED, { orderId });
}

function refundOfOrder(scene: Scene, orderId: string, refundedAmount: number): string {
  scene.refunded.set(orderId, bdt(refundedAmount));
  const paymentId = newId();
  scene.allocations.set(paymentId, [
    { requestType: PAYMENT_REQUEST_TYPE.ORDER, requestId: orderId },
  ]);
  return paymentId;
}

async function orderEntriesOf(scene: Scene, orderId: string) {
  return withOrganizationContext(scene.organizationId, () =>
    scene.dependencies.entries.listBySource(COMMISSION_SOURCE_TYPE.ORDER_LINE, orderId),
  );
}

/** Marks units of every line of the order as returned, as the sales module does before it emits the event. */
function returnUnits(scene: Scene, orderId: string, units: number): void {
  const order = scene.orders.get(orderId);
  if (order === undefined) throw new Error("order fixture missing");
  scene.orders.set(orderId, {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      returnedQuantity: Math.min(line.quantity, line.returnedQuantity + units),
    })),
  });
}

/** The reverse of a return: the sales module lowers the returned quantity before it emits the event. */
function unreturnUnits(scene: Scene, orderId: string, units: number): void {
  const order = scene.orders.get(orderId);
  if (order === undefined) throw new Error("order fixture missing");
  scene.orders.set(orderId, {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      returnedQuantity: Math.max(0, line.returnedQuantity - units),
    })),
  });
}

function reversalEnvelope(scene: Scene, orderId: string): HandlerInput {
  return envelope(scene, EVENT_TYPE.SALES_RETURN_REVERSED, { salesReturnId: newId(), orderId });
}

function returnEnvelope(scene: Scene, orderId: string): HandlerInput {
  return envelope(scene, EVENT_TYPE.SALES_RETURN_CREATED, { salesReturnId: newId(), orderId });
}

function sumOfAmounts(entries: readonly { readonly amount: Money }[]): number {
  return entries.reduce((total, entry) => total + entry.amount.amount, 0);
}

describe("commission accrual on performed order lines", () => {
  it("accrues one entry per order line that names a performer when the order completes", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [
      { memberId: scene.memberId, ...FIRST_LINE },
      { memberId: scene.memberId, ...SECOND_LINE },
    ]);

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(orderEnvelope(scene, orderId)),
    );

    const entries = await orderEntriesOf(scene, orderId);
    expect(entries.map((entry) => entry.amount.amount)).toEqual([10_000, 5000]);
    expect(entries.every((entry) => entry.sourceType === COMMISSION_SOURCE_TYPE.ORDER_LINE)).toBe(
      true,
    );
    expect(entries.every((entry) => entry.sourceGrossTotal.amount === ORDER_GROSS)).toBe(true);
  });

  it("takes the line's net amount without tax as the base, after the order discount share", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(orderEnvelope(scene, orderId)),
    );

    const [entry] = await orderEntriesOf(scene, orderId);
    expect(entry?.base).toEqual(bdt(FIRST_LINE.net - FIRST_LINE.tax));
    expect(entry?.amount).toEqual(bdt(10_000));
    expect(entry?.sourceNumber).toBe("000077");
  });

  it("writes nothing for a line without a performer or without a matching rule", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const unruledMember = newId();
    const orderId = addOrder(scene, [
      { memberId: null, ...FIRST_LINE },
      { memberId: unruledMember, ...SECOND_LINE },
    ]);

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(orderEnvelope(scene, orderId)),
    );

    expect(await orderEntriesOf(scene, orderId)).toHaveLength(0);
  });

  it("a second delivery of the completion event writes no second entry", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));

    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));

    expect(await orderEntriesOf(scene, orderId)).toHaveLength(1);
  });

  it("a partial return lowers that line's commission by its returned share", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }], 2);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));
    const [accrual] = await orderEntriesOf(scene, orderId);
    const accrualAmount = accrual?.amount.amount ?? 0;

    returnUnits(scene, orderId, 1);
    await runAs(scene, () => handler.handle(returnEnvelope(scene, orderId)));

    const entries = await orderEntriesOf(scene, orderId);
    expect(sumOfAmounts(entries)).toBe(accrualAmount - Math.floor(accrualAmount / 2));
  });

  it("a full return brings the line's commission to zero", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));

    returnUnits(scene, orderId, 1);
    await runAs(scene, () => handler.handle(returnEnvelope(scene, orderId)));

    expect(sumOfAmounts(await orderEntriesOf(scene, orderId))).toBe(0);
  });

  it("a reversed return raises the line commission back", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));
    const accrualAmount = sumOfAmounts(await orderEntriesOf(scene, orderId));
    returnUnits(scene, orderId, 1);
    await runAs(scene, () => handler.handle(returnEnvelope(scene, orderId)));
    expect(sumOfAmounts(await orderEntriesOf(scene, orderId))).toBe(0);

    unreturnUnits(scene, orderId, 1);
    await runAs(scene, () => handler.handle(reversalEnvelope(scene, orderId)));
    await runAs(scene, () => handler.handle(reversalEnvelope(scene, orderId)));

    expect(sumOfAmounts(await orderEntriesOf(scene, orderId))).toBe(accrualAmount);
  });

  it("a refund without a return leaves the order lines' commission unchanged", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));
    const refund = refundOfOrder(scene, orderId, ORDER_GROSS);

    await runAs(scene, () =>
      handler.handle(paymentEnvelope(scene, EVENT_TYPE.PAYMENT_REFUNDED, refund)),
    );

    expect(sumOfAmounts(await orderEntriesOf(scene, orderId))).toBe(10_000);
  });

  it("a return processed before the accrual is reconciled by the accrual", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }], 2);
    const handler = buildAccrueCommissionHandler(scene.dependencies);
    returnUnits(scene, orderId, 1);
    await runAs(scene, () => handler.handle(returnEnvelope(scene, orderId)));
    expect(await orderEntriesOf(scene, orderId)).toHaveLength(0);

    await runAs(scene, () => handler.handle(orderEnvelope(scene, orderId)));

    const [accrual, adjustment] = await orderEntriesOf(scene, orderId);
    const accrualAmount = accrual?.amount.amount ?? 0;
    expect(adjustment?.amount.amount).toBe(-Math.floor(accrualAmount / 2));
  });

  it("skips a line whose rule is in another currency and counts it", async () => {
    const scene = newScene();
    await runAs(scene, () =>
      addMemberRule(scene, { fixedAmount: { amount: 500, currency: "USD" as Money["currency"] } }),
    );
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);

    const result = await runAs(scene, () =>
      accrueCompletedOrder(scene.dependencies, {
        orderId,
        context: {
          organizationId: scene.organizationId,
          actorUserId: null,
          occurredAt: COMPLETED_AT,
        },
      }),
    );

    expect(result).toEqual({ accruals: 0, adjustments: 0, skippedCurrency: 1 });
    expect(await orderEntriesOf(scene, orderId)).toHaveLength(0);
  });

  it("writes nothing for an order that is not completed", async () => {
    const scene = newScene();
    await runAs(scene, () => addMemberRule(scene));
    const orderId = addOrder(scene, [{ memberId: scene.memberId, ...FIRST_LINE }]);
    const stored = scene.orders.get(orderId);
    if (stored === undefined) throw new Error("order missing");
    scene.orders.set(orderId, { ...stored, status: ORDER_STATUS.PLACED });

    await runAs(scene, () =>
      buildAccrueCommissionHandler(scene.dependencies).handle(orderEnvelope(scene, orderId)),
    );

    expect(await orderEntriesOf(scene, orderId)).toHaveLength(0);
  });
});
