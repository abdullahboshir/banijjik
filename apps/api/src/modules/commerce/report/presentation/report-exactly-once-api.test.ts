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

/**
 * The order is the only fact this test controls: the source module is replaced by a map, so a test
 * can make the fact missing (a failure) and then present (the redelivery). Everything else is real:
 * the outbox row, the kernel runner, the report handler, the marker and the daily row in Mongo.
 */
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

/** Writes one `sales.order.completed` outbox row for the organization, as a use case would. */
async function publishOrderCompleted(
  organizationId: string,
  orderId: string,
): Promise<OutboxEventDocument> {
  await runWithRequestContext({ requestId: newId(), organizationId }, () =>
    withTransaction(() => publishEvent(EVENT_TYPE.ORDER_COMPLETED, { orderId })),
  );
  const row = await models({})
    .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
    .findOne({ organizationId, type: EVENT_TYPE.ORDER_COMPLETED })
    .sort({ createdAt: -1 })
    .lean<OutboxEventDocument>();
  if (row === null) throw new Error("the order event was not written");
  return row;
}

/** One handler in its own registry, so the test runs the real runner on exactly this handler. */
function registryWith(sources: ReportSourceReader, settings: OrganizationLocalSettings) {
  const registry = new EventHandlerRegistry();
  registry.register(buildReportEventHandler({ reader: sources, settings, clock: systemClock }));
  return registry;
}

/** The runner's input for one outbox row, exactly as the worker builds it. */
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

async function markerCountOf(organizationId: string, eventId: string): Promise<number> {
  return runInOrganizationContext(organizationId, () =>
    models({}).get(REPORT_EVENT_APPLIED_MODEL_NAME).countDocuments({ organizationId, eventId }),
  );
}

describe("report exactly-once counting in Mongo", () => {
  it("a completed order's event delivered twice through the outbox counts once in the stored row", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationA;
    const currency = (await buildOrganizationCurrencyReader().read(organizationId)) ?? "BDT";
    const sources = new OrderFactsOnly();
    const completedAt = new Date();
    sources.orders.set("order-once", {
      locationId: world.locationA1,
      currency,
      completedAt,
      subtotal: 1_000,
      discountTotal: 0,
      taxTotal: 0,
      deliveryCharge: 0,
      grandTotal: 1_000,
    });
    const settings = settingsFor(currency);
    const registry = registryWith(sources, settings);
    const handlerKey = "report.summarize";
    const event = await publishOrderCompleted(organizationId, "order-once");

    await runEventHandler(jobOf(event, handlerKey), registry, EFFECTIVE);
    await runEventHandler(jobOf(event, handlerKey), registry, EFFECTIVE);

    const row = await storedRowOf(
      organizationId,
      world.locationA1,
      businessDateOf(completedAt, ORGANIZATION_TIME_ZONE),
    );
    expect(row?.["ordersCompleted"]).toBe(1);
    expect(row?.["netSales"]).toBe(1_000);
    expect(await markerCountOf(organizationId, event.eventId)).toBe(1);
  });

  it("two parallel deliveries of the same event count once in the stored row", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationA;
    const currency = (await buildOrganizationCurrencyReader().read(organizationId)) ?? "BDT";
    const sources = new OrderFactsOnly();
    const completedAt = new Date();
    sources.orders.set("order-parallel", {
      locationId: world.locationA1,
      currency,
      completedAt,
      subtotal: 500,
      discountTotal: 0,
      taxTotal: 0,
      deliveryCharge: 0,
      grandTotal: 500,
    });
    const registry = registryWith(sources, settingsFor(currency));
    const event = await publishOrderCompleted(organizationId, "order-parallel");
    const job = jobOf(event, "report.summarize");

    await Promise.all([
      runEventHandler(job, registry, EFFECTIVE),
      runEventHandler(job, registry, EFFECTIVE),
    ]);

    const row = await storedRowOf(
      organizationId,
      world.locationA1,
      businessDateOf(completedAt, ORGANIZATION_TIME_ZONE),
    );
    expect(row?.["ordersCompleted"]).toBe(1);
    expect(await markerCountOf(organizationId, event.eventId)).toBe(1);
  });

  it("a failure after the marker rolls the marker back, so a redelivery counts", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationA;
    const currency = (await buildOrganizationCurrencyReader().read(organizationId)) ?? "BDT";
    const sources = new OrderFactsOnly();
    const completedAt = new Date();
    // The fact is not there yet: the handler writes its marker first, then fails on the missing fact.
    const registry = registryWith(sources, settingsFor(currency));
    const event = await publishOrderCompleted(organizationId, "order-late");
    const job = jobOf(event, "report.summarize");

    await expect(runEventHandler(job, registry, EFFECTIVE)).rejects.toThrow();
    expect(await markerCountOf(organizationId, event.eventId)).toBe(0);

    sources.orders.set("order-late", {
      locationId: world.locationA1,
      currency,
      completedAt,
      subtotal: 700,
      discountTotal: 0,
      taxTotal: 0,
      deliveryCharge: 0,
      grandTotal: 700,
    });
    await runEventHandler(job, registry, EFFECTIVE);

    const row = await storedRowOf(
      organizationId,
      world.locationA1,
      businessDateOf(completedAt, ORGANIZATION_TIME_ZONE),
    );
    expect(row?.["ordersCompleted"]).toBe(1);
    expect(await markerCountOf(organizationId, event.eventId)).toBe(1);
  });
});

function settingsFor(currency: string): OrganizationLocalSettings {
  return {
    timeZoneOf: async () => ORGANIZATION_TIME_ZONE,
    currencyOf: async () => currency,
  };
}
