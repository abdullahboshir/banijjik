import { EVENT_TYPE, type EventType } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models, withTransaction } from "../../../../kernel/db/index.js";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { EventHandlerRegistry } from "../../../../kernel/events/event-handler-registry.js";
import { runEventHandler } from "../../../../kernel/events/handler-runner.js";
import {
  OUTBOX_EVENT_MODEL_NAME,
  type OutboxEventDocument,
} from "../../../../kernel/events/outbox-event.schema.js";
import { publishEvent } from "../../../../kernel/events/publish-event.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { systemClock } from "../../../../kernel/time/index.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { createTwoOrganizations } from "../../../../test-support/two-organizations.js";
import { buildOrganizationCurrencyReader } from "../../../core/organization/index.js";
import {
  buildReportEventHandler,
  DAILY_SUMMARY_MODEL_NAME,
  REPORT_EVENT_APPLIED_MODEL_NAME,
  type OrganizationLocalSettings,
  type ReportSourceReader,
} from "../index.js";
import type { OrderFact } from "../application/ports/report-ports.js";
import { businessDateOf } from "../domain/business-date.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

const ORGANIZATION_TIME_ZONE = "Asia/Dhaka";
const EFFECTIVE = { isEffective: async () => true };

class OrderFactsOnly implements ReportSourceReader {
  readonly orders = new Map<string, OrderFact>();
  async readOrderFacts(orderId: string) {
    return this.orders.get(orderId);
  }
  async readSalesReturnFacts() {
    return undefined;
  }
  async readBookingFacts() {
    return undefined;
  }
  async readEnrollmentLocationId() {
    return undefined;
  }
  async readPaymentFacts() {
    return undefined;
  }
  async readExpenseFacts() {
    return undefined;
  }
}

async function publishOrderEvent(
  organizationId: string,
  eventType: EventType,
  orderId: string,
): Promise<OutboxEventDocument> {
  const publishedEventId = newId();
  await runWithRequestContext({ requestId: newId(), organizationId }, () =>
    withTransaction(() => publishEvent(eventType, { orderId })),
  );
  const row = await models({})
    .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
    .findOne({ organizationId, type: eventType })
    .sort({ createdAt: -1 })
    .lean<OutboxEventDocument>();
  if (row === null) throw new Error(`the order event ${eventType} was not written`);
  return row;
}

function registryWith(sources: ReportSourceReader, settings: OrganizationLocalSettings) {
  const registry = new EventHandlerRegistry();
  registry.register(buildReportEventHandler({ reader: sources, settings, clock: systemClock }));
  return registry;
}

function jobOf(event: OutboxEventDocument, handlerKey: string) {
  return {
    eventId: event.eventId,
    handlerKey,
    type: event.type as EventType,
    organizationId: event.organizationId ?? "",
  };
}

async function storedRowOf(organizationId: string, locationId: string, businessDate: string) {
  return runInOrganizationContext(organizationId, () =>
    models({})
      .get<Record<string, unknown>>(DAILY_SUMMARY_MODEL_NAME)
      .findOne({ organizationId, locationId, businessDate })
      .lean<Record<string, unknown>>(),
  );
}

function settingsFor(currency: string): OrganizationLocalSettings {
  return {
    timeZoneOf: async () => ORGANIZATION_TIME_ZONE,
    currencyOf: async () => currency,
  };
}

describe("report delivery, RTS, and loss closure daily counting", () => {
  it("order shipment increments sales figures, and subsequent reshipment does not duplicate", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationA;
    const currency = (await buildOrganizationCurrencyReader().read(organizationId)) ?? "BDT";
    const sources = new OrderFactsOnly();
    const shippedAt = new Date();
    const bDate = businessDateOf(shippedAt, ORGANIZATION_TIME_ZONE);

    sources.orders.set("order-ship-live", {
      orderId: "order-ship-live",
      locationId: world.locationA1,
      currency,
      completedAt: null,
      shippedAt,
      firstShipmentBusinessDate: bDate,
      subtotal: 10_000,
      discountTotal: 500,
      taxTotal: 750,
      deliveryCharge: 200,
      grandTotal: 10_450,
    });

    const settings = settingsFor(currency);
    const registry = registryWith(sources, settings);
    const handlerKey = "report.summarize";

    // Attempt 1 shipment
    const shipEvent1 = await publishOrderEvent(
      organizationId,
      EVENT_TYPE.ORDER_SHIPPED,
      "order-ship-live",
    );
    await runEventHandler(jobOf(shipEvent1, handlerKey), registry, EFFECTIVE);

    const rowAfterAttempt1 = await storedRowOf(organizationId, world.locationA1, bDate);
    expect(rowAfterAttempt1?.["ordersCompleted"]).toBe(1);
    expect(rowAfterAttempt1?.["grossSales"]).toBe(10_000);
    expect(rowAfterAttempt1?.["netSales"]).toBe(10_450);
    expect(rowAfterAttempt1?.["deliveryCharges"]).toBe(200);

    // Attempt 2 reshipment (distinct outbox event with its own eventId)
    const shipEvent2 = await publishOrderEvent(
      organizationId,
      EVENT_TYPE.ORDER_SHIPPED,
      "order-ship-live",
    );
    await runEventHandler(jobOf(shipEvent2, handlerKey), registry, EFFECTIVE);

    const rowAfterAttempt2 = await storedRowOf(organizationId, world.locationA1, bDate);
    expect(rowAfterAttempt2?.["ordersCompleted"]).toBe(1);
    expect(rowAfterAttempt2?.["netSales"]).toBe(10_450);
  });

  it("order returned to sender (RTS) increments returns count and returns value", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationA;
    const currency = (await buildOrganizationCurrencyReader().read(organizationId)) ?? "BDT";
    const sources = new OrderFactsOnly();
    const bDate = businessDateOf(new Date(), ORGANIZATION_TIME_ZONE);

    sources.orders.set("order-rts-live", {
      orderId: "order-rts-live",
      locationId: world.locationA1,
      currency,
      completedAt: null,
      subtotal: 5_000,
      discountTotal: 0,
      taxTotal: 0,
      deliveryCharge: 150,
      grandTotal: 5_150,
    });

    const settings = settingsFor(currency);
    const registry = registryWith(sources, settings);
    const handlerKey = "report.summarize";

    const rtsEvent = await publishOrderEvent(
      organizationId,
      EVENT_TYPE.ORDER_RETURNED_TO_SENDER,
      "order-rts-live",
    );
    await runEventHandler(jobOf(rtsEvent, handlerKey), registry, EFFECTIVE);

    const row = await storedRowOf(organizationId, world.locationA1, bDate);
    expect(row?.["returnsCount"]).toBe(1);
    expect(row?.["returnsValue"]).toBe(5_150);
  });

  it("order delivery loss closed increments returns count and returns value", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationA;
    const currency = (await buildOrganizationCurrencyReader().read(organizationId)) ?? "BDT";
    const sources = new OrderFactsOnly();
    const bDate = businessDateOf(new Date(), ORGANIZATION_TIME_ZONE);

    sources.orders.set("order-loss-live", {
      orderId: "order-loss-live",
      locationId: world.locationA1,
      currency,
      completedAt: null,
      subtotal: 8_000,
      discountTotal: 0,
      taxTotal: 0,
      deliveryCharge: 200,
      grandTotal: 8_200,
    });

    const settings = settingsFor(currency);
    const registry = registryWith(sources, settings);
    const handlerKey = "report.summarize";

    const lossEvent = await publishOrderEvent(
      organizationId,
      EVENT_TYPE.ORDER_DELIVERY_LOSS_CLOSED,
      "order-loss-live",
    );
    await runEventHandler(jobOf(lossEvent, handlerKey), registry, EFFECTIVE);

    const row = await storedRowOf(organizationId, world.locationA1, bDate);
    expect(row?.["returnsCount"]).toBe(1);
    expect(row?.["returnsValue"]).toBe(8_200);
  });
});
