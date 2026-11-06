import {
  CURRENCY_CODE,
  ERROR_CODE,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  OUTBOX_STATUS,
  SEED_INDUSTRY_TEMPLATE_KEY,
} from "@banijjik/contracts";
import {
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_HOLD_MINUTES_SETTING_KEY,
  BOOKING_STATUS,
  DEPOSIT_REQUIRED,
} from "@banijjik/contracts/booking";
import { PAYMENT_METHOD, PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import {
  SF_GUEST_COOKIE_NAME,
  WEBSITE_CHECKOUT_ENABLED_SETTING_KEY,
  WEBSITE_EVENT_TYPE,
  WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY,
  type CheckoutDetailResponse,
  type CheckoutResponse,
  type CheckoutSelection,
  type PublicQuoteResponse,
} from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type EventSessionId,
  type OrganizationId,
  type ResourceId,
} from "@banijjik/ids";
import type { WithId, Document as MongoDocument } from "mongodb";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { MongoUnitOfWork, models } from "../../../kernel/db/index.js";
import { eventHandlerRegistry, kernelEventPublisher } from "../../../kernel/events/index.js";
import type { EventJobData, EventJobQueue } from "../../../kernel/events/event-job.js";
import { runEventHandler } from "../../../kernel/events/handler-runner.js";
import type { ModuleEffectiveness } from "../../../kernel/events/module-effectiveness.js";
import { OutboxDispatcher } from "../../../kernel/events/outbox-dispatcher.js";
import {
  OUTBOX_EVENT_MODEL_NAME,
  type OutboxEventDocument,
} from "../../../kernel/events/outbox-event.schema.js";
import { jobRegistry, runScheduledJob } from "../../../kernel/jobs/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { registerAccountingAndExpenseHandlers } from "../../../routes/accounting-event-handlers.js";
import { buildBookingDepositCheckAdapter } from "../../../routes/booking-deposit-adapter.js";
import { MODULE_MANIFESTS, buildModuleRegistry } from "../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../routes/organization-config-ports.js";
import {
  buildPaymentRequestLifecycles,
  buildPaymentRequestReaders,
} from "../../../routes/payment-request-readers.js";
import { registerReportEventHandlers } from "../../../routes/report-event-handlers.js";
import { processOrganizationOutbox } from "../../../test-support/outbox-replay.js";
import { createHall } from "../../../test-support/booking-hall-world.js";
import {
  publishBookableEvent,
  publishBookableRental,
  publishBookableService,
} from "../../../test-support/booking-api-world.js";
import { money, startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { enableDirectoryForWorld } from "../../../test-support/directory-world.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import {
  addInventoryItem,
  levelOf,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
} from "../../../test-support/sales-api-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  freshPhone,
  signInCustomer,
} from "../../../test-support/storefront-world.js";
import { parseSetCookies } from "../../../test-support/auth-api-client.js";
import type { ApiActor, TwoOrganizations } from "../../../test-support/two-organizations.js";
import {
  MongoEventSessionRepository,
  MongoResourceSlotUsageRepository,
  BOOKING_MODEL_NAME,
  buildOrganizationTimezoneReader,
  MongoBookingRepository,
  registerBookingScheduledJobs,
} from "../booking/index.js";
import { buildOrderSnapshotReader } from "../sales/index.js";
import {
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  MongoContactStoreCreditAdapter,
  ReceivePaymentUseCase,
} from "../payment/index.js";
import { buildOrgConfigService } from "../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../platform/industry/index.js";
import { CHECKOUT_MODEL_NAME } from "./infrastructure/checkout.schema.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const MATRIMONY = { industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY };
/**
 * No seed template enables all five offering kinds, so the mixed scenario runs on the SALON
 * template widened to the commerce surface this card must prove. It keeps the STYLIST resource
 * type the booking helpers use and adds the enrollment and credit modules.
 */
const COMMERCE = { industryTemplateKey: "SALON" };
/** 04:00Z is 10:00 in the default Asia/Dhaka organization timezone. */
const SUNDAY_SERVICE_START = "2026-11-01T04:00:00.000Z";
const SUNDAY_RENTAL_START = "2026-11-01T05:00:00.000Z";
const SUNDAY_RENTAL_END = "2026-11-01T06:00:00.000Z";
const SUNDAY_EVENT_START = "2026-11-01T07:00:00.000Z";
const SUNDAY_EVENT_END = "2026-11-01T09:00:00.000Z";
const SUNDAY_PLAN_STARTS_ON = "2026-11-01";
const UNPAID_HOLD_START = "2026-11-01T05:30:00.000Z";
const UNPAID_HOLD_END = "2026-11-01T06:00:00.000Z";
const SERVICE_START_END = "2026-11-01T04:30:00.000Z";

const PRODUCT_UNIT_PRICE = 2500;
const PRODUCT_QUANTITY = 2;
const SERVICE_UNIT_PRICE = 50_000;
const RENTAL_UNIT_PRICE = 3000;
const EVENT_UNIT_PRICE = 4000;
const PLAN_RECURRING_FEE = 5000;
const PLAN_ADMISSION_FEE = 1000;
const PLAN_SECURITY_DEPOSIT = 2000;
const PLAN_UPFRONT = PLAN_ADMISSION_FEE + PLAN_RECURRING_FEE + PLAN_SECURITY_DEPOSIT;
const MIXED_QUOTE_TOTAL =
  PRODUCT_UNIT_PRICE * PRODUCT_QUANTITY +
  SERVICE_UNIT_PRICE +
  RENTAL_UNIT_PRICE +
  EVENT_UNIT_PRICE +
  PLAN_RECURRING_FEE;
const DEPOSIT_MINOR = 1000;
const HOLD_MINUTES = 15;
const ALWAYS_EFFECTIVE: ModuleEffectiveness = { isEffective: async () => true };

let harness: IamApiHarness;

/**
 * Both template rows are platform documents in a database every other suite in this run shares,
 * so the widening below is snapshotted first and put back in `afterAll` (review R1 must-fix 3).
 */
let widenedTemplates: readonly WithId<MongoDocument>[] = [];

beforeAll(async () => {
  harness = await startCatalogApi();
  widenedTemplates = await harness.connections.platform
    .collection("industry_templates")
    .find({
      industryTemplateKey: {
        $in: [SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY, COMMERCE.industryTemplateKey],
      },
    })
    .toArray();
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY },
      { $set: { status: "PUBLISHED" }, $inc: { version: 1 } },
    );
  await harness.connections.platform.collection("industry_templates").updateOne(
    { industryTemplateKey: COMMERCE.industryTemplateKey },
    {
      $set: { enabledKinds: ["PRODUCT", "SERVICE", "RENTAL", "EVENT", "PLAN"] },
      $addToSet: { allowedModuleKeys: { $each: ["enrollment", "credit"] } },
      $inc: { version: 1 },
    },
  );
  ensureWorkerRegistrations();
});

afterAll(async () => {
  const templates = harness.connections.platform.collection("industry_templates");
  for (const row of widenedTemplates) {
    await templates.replaceOne({ _id: row._id }, row);
  }
  await harness.dispose();
});

class RecordingQueue implements EventJobQueue {
  readonly jobs: EventJobData[] = [];
  async enqueue(job: EventJobData): Promise<void> {
    this.jobs.push(job);
  }
}

function requirePresent<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`expected ${label}`);
  return value;
}

function variantOf(
  offering: { readonly variants: readonly { readonly variantId: string }[] },
  index = 0,
): string {
  return requirePresent(offering.variants[index], "offering variant").variantId;
}

function buildOrgConfig() {
  const registry = buildModuleRegistry();
  return buildOrgConfigService({
    registry,
    clock: harness.clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(harness.clock),
  });
}

/** Same registrations `start-worker.ts` makes, once per process, so a neighbour file can go first. */
function ensureWorkerRegistrations(): void {
  if (eventHandlerRegistry.find("accounting.postPayments") === undefined) {
    registerAccountingAndExpenseHandlers();
  }
  if (eventHandlerRegistry.find("report.summarize") === undefined) {
    registerReportEventHandlers(harness.clock);
  }
  if (jobRegistry.find("booking.expireHolds") === undefined) {
    registerBookingScheduledJobs({
      clock: harness.clock,
      orgConfig: buildOrgConfig(),
      manifests: MODULE_MANIFESTS,
      depositCheck: buildBookingDepositCheckAdapter(),
      audit: buildAuditRecorder(harness.clock),
    });
  }
}

async function grantAllCommerceModules(organizationId: string): Promise<void> {
  const modulesToGrant = [
    MODULE_KEY.WEBSITE,
    MODULE_KEY.SALES,
    MODULE_KEY.BOOKING,
    MODULE_KEY.ENROLLMENT,
    MODULE_KEY.CREDIT,
    MODULE_KEY.ACCOUNTING,
    MODULE_KEY.REPORT,
  ];
  for (const moduleKey of modulesToGrant) {
    await writeModuleOverride({
      organizationId,
      moduleKey,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
  }
}

type ShopWorld = ReturnType<typeof shopOf> & { readonly world: TwoOrganizations };

/** A retail world with the website module on and public checkout enabled, like a live site. */
async function commerceShop(): Promise<ShopWorld> {
  const world = await worldFor(harness, RETAIL, COMMERCE);
  const shop = shopOf(world);
  await grantAllCommerceModules(shop.organizationId);
  await setSetting(shop, WEBSITE_CHECKOUT_ENABLED_SETTING_KEY, true);
  return { ...shop, world };
}

function guestCookieOf(response: Response): string {
  const cookie = parseSetCookies(response).find((row) => row.name === SF_GUEST_COOKIE_NAME);
  if (cookie === undefined) throw new Error("guest cookie missing");
  return cookie.value;
}

async function newGuest(organizationId: string): Promise<Record<string, string>> {
  const created = await callStorefront(harness.app, {
    method: "post",
    organizationId,
    suffix: "/guest-session",
    body: {},
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return { [SF_GUEST_COOKIE_NAME]: guestCookieOf(created) };
}

async function quote(
  shop: ShopWorld,
  cookies: Record<string, string>,
  selections: readonly CheckoutSelection[],
): Promise<PublicQuoteResponse> {
  const response = await callStorefront(harness.app, {
    method: "post",
    organizationId: shop.organizationId,
    suffix: "/quotes",
    body: { locationId: shop.locationId, selections, fulfillment: { method: "PICKUP" } },
    cookies,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data as PublicQuoteResponse;
}

async function serviceAvailability(
  shop: ShopWorld,
  service: { readonly offeringId: string; readonly variantId: string },
  locationId: string,
): Promise<Response> {
  return callStorefront(harness.app, {
    method: "get",
    organizationId: shop.organizationId,
    suffix: "/availability",
    query: {
      offeringId: service.offeringId,
      variantId: service.variantId,
      locationId,
      startDate: "2026-11-01",
      endDate: "2026-11-01",
    },
  });
}

async function tenantDocumentCount(organizationId: string, modelName: string): Promise<number> {
  return runInOrganizationContext(organizationId, () =>
    models({}).get(modelName).countDocuments({ organizationId }),
  );
}

async function submitCheckout(
  shop: ShopWorld,
  cookies: Record<string, string>,
  quoteId: string,
  contact: { readonly name: string; readonly phone: string },
  idempotencyKey = newId(),
): Promise<Response> {
  return callStorefront(harness.app, {
    method: "post",
    organizationId: shop.organizationId,
    suffix: "/checkout",
    body: { quoteId, contact },
    cookies,
    idempotencyKey,
  });
}

function productSelection(
  product: { offeringId: string; variantId: string },
  quantity: number,
  selectionId = "sel-product",
): CheckoutSelection {
  return {
    selectionId,
    selection: {
      kind: "PRODUCT",
      offeringId: product.offeringId,
      variantId: product.variantId,
      quantity,
      modifierOptionIds: [],
    },
    customFields: {},
  };
}

function lineTotalOf(quoted: PublicQuoteResponse, selectionId: string): number {
  const line = requirePresent(
    quoted.lines.find((row) => row.selectionId === selectionId),
    `quote line ${selectionId}`,
  );
  return line.total.amount;
}

async function publishPlanOffering(
  actor: ApiActor,
  organizationId: string,
): Promise<{ offeringId: string; variantId: string }> {
  const created = await actor.call("post", `/orgs/${organizationId}/offerings`, {
    kind: "PLAN",
    name: "Membership Plan",
    kindDetails: {
      billingPeriod: { unit: "MONTH", count: 1 },
      freezeAllowed: true,
      maxFreezeDaysPerYear: 30,
      startRule: "ANY_DATE",
      autoRenewDefault: false,
      admissionFee: money(PLAN_ADMISSION_FEE),
      securityDeposit: money(PLAN_SECURITY_DEPOSIT),
    },
    variants: [{ name: "Standard", price: money(PLAN_RECURRING_FEE), unitKey: "SESSION" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const offering = created.body.data as {
    offeringId: string;
    version: number;
    variants: { variantId: string }[];
  };
  const published = await actor.call(
    "post",
    `/orgs/${organizationId}/offerings/${offering.offeringId}/publish`,
    { version: offering.version },
  );
  expect(published.status).toBe(200);
  return { offeringId: offering.offeringId, variantId: variantOf(offering) };
}

async function createEventSession(
  shop: ShopWorld,
  offering: { readonly offeringId: string },
  variantId: string,
  capacity: number,
): Promise<string> {
  const created = await shop.actor.call("post", `/orgs/${shop.organizationId}/event-sessions`, {
    offeringId: offering.offeringId,
    variantId,
    locationId: shop.locationId,
    startsAt: SUNDAY_EVENT_START,
    endsAt: SUNDAY_EVENT_END,
    capacity,
    resourceIds: [],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return requirePresent(
    (created.body.data as { eventSessionId?: string }).eventSessionId,
    "eventSessionId",
  );
}

function platformOutbox() {
  return models({}).get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME);
}

function outboxRows(organizationId: string, type: string) {
  return platformOutbox().find({ organizationId, type }).lean<OutboxEventDocument[]>();
}

function pendingOutboxCount(organizationId: string): Promise<number> {
  return platformOutbox().countDocuments({ organizationId, status: OUTBOX_STATUS.PENDING });
}

function buildPaymentStack() {
  const orgConfig = buildOrgConfig();
  const audit = buildAuditRecorder(harness.clock);
  const timeZone = buildOrganizationTimezoneReader();
  const unitOfWork = new MongoUnitOfWork();
  const receivePayment = new ReceivePaymentUseCase({
    payments: new MongoPaymentRepository(),
    storeCredit: new MongoStoreCreditRepository(),
    summaries: new MongoPaymentSummaryRepository(),
    contactStoreCredit: new MongoContactStoreCreditAdapter(),
    requestReaders: buildPaymentRequestReaders(),
    lifecycles: buildPaymentRequestLifecycles({
      orgConfig,
      manifests: MODULE_MANIFESTS,
      clock: harness.clock,
      audit,
    }),
    unitOfWork,
    events: kernelEventPublisher,
    audit,
    clock: harness.clock,
    timeZone,
    orgConfig,
  });
  return { orgConfig, unitOfWork, receivePayment };
}

interface MixedCatalog {
  readonly product: { offeringId: string; variantId: string };
  readonly service: { offeringId: string; variantId: string };
  readonly rental: { offeringId: string; variantId: string };
  readonly event: { offeringId: string; variantId: string; eventSessionId: string };
  readonly plan: { offeringId: string; variantId: string };
  readonly selections: readonly CheckoutSelection[];
}

async function buildMixedCatalog(shop: ShopWorld): Promise<MixedCatalog> {
  const itemId = await addInventoryItem(shop, "T-Shirt");
  await receiveStock(shop, [{ inventoryItemId: itemId, quantity: 20, unitCostAmount: 200 }]);
  const product = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Cotton T-Shirt",
    priceAmount: PRODUCT_UNIT_PRICE,
    stockComponents: [{ inventoryItemId: itemId, quantity: 1 }],
  });

  const serviceOffering = await publishBookableService(shop.actor, shop.organizationId);
  const serviceResourceId = await createHall(harness, shop.actor, {
    organizationId: shop.organizationId,
    locationId: shop.locationId,
    offeringIds: [serviceOffering.offeringId],
    capacity: 5,
    name: "Stylist 1",
  });

  const rentalOffering = await publishBookableRental(shop.actor, shop.organizationId, {
    name: "Studio Space",
    rateUnit: "HOUR",
    minUnits: 1,
    resourceTypeKeys: ["STYLIST"],
    unitPriceAmount: RENTAL_UNIT_PRICE,
  });
  const rentalResourceId = await createHall(harness, shop.actor, {
    organizationId: shop.organizationId,
    locationId: shop.locationId,
    offeringIds: [rentalOffering.offeringId],
    capacity: 2,
    name: "Studio Room A",
  });

  const eventOffering = await publishBookableEvent(shop.actor, shop.organizationId, {
    name: "Baking Masterclass",
    unitPriceAmount: EVENT_UNIT_PRICE,
  });
  const eventVariantId = variantOf(eventOffering);
  const eventSessionId = await createEventSession(shop, eventOffering, eventVariantId, 10);
  const plan = await publishPlanOffering(shop.actor, shop.organizationId);
  const service = variantOf(serviceOffering);
  const rental = variantOf(rentalOffering);

  return {
    product: { offeringId: product.offeringId, variantId: product.variantId },
    service: { offeringId: serviceOffering.offeringId, variantId: service },
    rental: { offeringId: rentalOffering.offeringId, variantId: rental },
    event: { offeringId: eventOffering.offeringId, variantId: eventVariantId, eventSessionId },
    plan,
    selections: [
      productSelection(product, PRODUCT_QUANTITY),
      {
        selectionId: "sel-service",
        selection: {
          kind: "SERVICE",
          offeringId: serviceOffering.offeringId,
          variantId: service,
          startsAt: SUNDAY_SERVICE_START,
          resourceIds: [serviceResourceId],
        },
        customFields: {},
      },
      {
        selectionId: "sel-rental",
        selection: {
          kind: "RENTAL",
          offeringId: rentalOffering.offeringId,
          variantId: rental,
          startsAt: SUNDAY_RENTAL_START,
          endsAt: SUNDAY_RENTAL_END,
          resourceIds: [rentalResourceId],
        },
        customFields: {},
      },
      {
        selectionId: "sel-event",
        selection: {
          kind: "EVENT",
          offeringId: eventOffering.offeringId,
          variantId: eventVariantId,
          eventSessionId,
          quantity: 1,
        },
        customFields: {},
      },
      {
        selectionId: "sel-plan",
        selection: {
          kind: "PLAN",
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: SUNDAY_PLAN_STARTS_ON,
          resourceIds: [],
        },
        customFields: {},
      },
    ],
  };
}

function assertMixedQuoteTotals(quoted: PublicQuoteResponse): void {
  expect(quoted.lines).toHaveLength(5);
  expect(lineTotalOf(quoted, "sel-product")).toBe(PRODUCT_UNIT_PRICE * PRODUCT_QUANTITY);
  expect(lineTotalOf(quoted, "sel-service")).toBe(SERVICE_UNIT_PRICE);
  expect(lineTotalOf(quoted, "sel-rental")).toBe(RENTAL_UNIT_PRICE);
  expect(lineTotalOf(quoted, "sel-event")).toBe(EVENT_UNIT_PRICE);
  expect(lineTotalOf(quoted, "sel-plan")).toBe(PLAN_RECURRING_FEE);
  expect(quoted.total.amount).toBe(MIXED_QUOTE_TOTAL);
  expect(quoted.total.currency).toBe(CURRENCY_CODE.BDT);
}

/**
 * `claimNextEvent` is global and skips rows whose `nextAttemptAt` / `lockedUntil` is still ahead of
 * `clock.now()`. A retry backoff of 5 s would otherwise make `dispatchBatch` return 0 while this
 * org's `checkout.created` stayed PENDING. The catch-up clock is the in-process equivalent of the
 * worker waiting for the next tick.
 */
const DISPATCH_CATCH_UP_MS = 24 * 60 * 60 * 1000;

async function dispatchUntilOrgQuiet(organizationId: string, queue: RecordingQueue): Promise<void> {
  const dispatcher = new OutboxDispatcher({
    queue,
    registry: eventHandlerRegistry,
    clock: { now: () => new Date(Date.now() + DISPATCH_CATCH_UP_MS) },
    batchSize: 200,
  });
  for (let round = 0; round < 80; round += 1) {
    const handled = await dispatcher.dispatchBatch();
    if ((await pendingOutboxCount(organizationId)) === 0) return;
    if (handled === 0) {
      throw new Error(
        `outbox dispatcher claimed nothing while events stay PENDING for ${organizationId}`,
      );
    }
  }
  throw new Error(`outbox still PENDING for ${organizationId} after dispatch rounds`);
}

/**
 * Production path: OutboxDispatcher claims rows (ADR-090), enqueues one job per handler, then
 * `runEventHandler` is the worker's exactly-once runner. A second pass must be a no-op.
 */
async function dispatchAndDeliverThisOrg(organizationId: string): Promise<readonly EventJobData[]> {
  const queue = new RecordingQueue();
  await dispatchUntilOrgQuiet(organizationId, queue);
  const ours = queue.jobs.filter((job) => job.organizationId === organizationId);
  await processOrganizationOutbox(organizationId);
  for (const job of ours) {
    expect(await runEventHandler(job, eventHandlerRegistry, ALWAYS_EFFECTIVE)).toBe(
      "ALREADY_PROCESSED",
    );
  }
  return ours;
}

function rowForCheckout(
  rows: readonly OutboxEventDocument[],
  checkoutId: string,
): OutboxEventDocument {
  return requirePresent(
    rows.find((row) => (row.payload as { checkoutId?: string }).checkoutId === checkoutId),
    "checkout.created outbox row",
  );
}

function rowForRequest(
  rows: readonly OutboxEventDocument[],
  field: "orderId" | "enrollmentId",
  requestId: string,
): OutboxEventDocument {
  return requirePresent(
    rows.find((row) => (row.payload as Record<string, string | undefined>)[field] === requestId),
    `${field} outbox row`,
  );
}

async function assertOutboxDelivery(
  shop: ShopWorld,
  checkout: CheckoutResponse,
  jobs: readonly EventJobData[],
): Promise<void> {
  const createdRows = await outboxRows(shop.organizationId, WEBSITE_EVENT_TYPE.CHECKOUT_CREATED);
  const createdRow = rowForCheckout(createdRows, checkout.checkoutId);
  expect(createdRow.organizationId).toBe(shop.organizationId);
  expect(createdRow.status).toBe(OUTBOX_STATUS.DISPATCHED);
  expect(eventHandlerRegistry.handlersFor(createdRow)).toHaveLength(0);
  expect(jobs.filter((job) => job.eventId === createdRow.eventId)).toHaveLength(0);

  const orderLink = requirePresent(
    checkout.requests.find((link) => link.requestType === "ORDER"),
    "order link",
  );
  const placedRows = await outboxRows(shop.organizationId, SALES_EVENT_TYPE.ORDER_PLACED);
  const placedRow = rowForRequest(placedRows, "orderId", orderLink.requestId);
  expect(placedRow.status).toBe(OUTBOX_STATUS.DISPATCHED);
  expect(placedRow.organizationId).toBe(shop.organizationId);
  expect(eventHandlerRegistry.handlersFor(placedRow).length).toBeGreaterThan(0);
  const placedJobs = jobs.filter((job) => job.eventId === placedRow.eventId);
  expect(placedJobs.length).toBeGreaterThan(0);
  const placedJob = requirePresent(placedJobs[0], "order.placed handler job");
  expect(placedJob.type).toBe(SALES_EVENT_TYPE.ORDER_PLACED);
  expect(placedJob.organizationId).toBe(shop.organizationId);
  expect(placedJob.handlerKey.length).toBeGreaterThan(0);
}

async function assertReportsAndAccounting(
  shop: ShopWorld,
  checkout: CheckoutResponse,
): Promise<void> {
  const orderLink = requirePresent(
    checkout.requests.find((link) => link.requestType === "ORDER"),
    "order link",
  );
  const bookingLinks = checkout.requests.filter((link) => link.requestType === "BOOKING");
  const enrollmentLink = requirePresent(
    checkout.requests.find((link) => link.requestType === "ENROLLMENT"),
    "enrollment link",
  );
  expect(enrollmentLink.paymentRequired.amount).toBe(PLAN_UPFRONT);
  expect(enrollmentLink.paymentRequired.currency).toBe(CURRENCY_CODE.BDT);

  const order = await runInOrganizationContext(shop.organizationId, () =>
    buildOrderSnapshotReader().read(asId(orderLink.requestId)),
  );
  expect(order?.status).toBe("PLACED");
  expect(order?.totals.grandTotal.amount).toBe(orderLink.paymentRequired.amount);

  const bookings = await runInOrganizationContext(shop.organizationId, () =>
    Promise.all(
      bookingLinks.map((link) => new MongoBookingRepository().findById(asId(link.requestId))),
    ),
  );
  expect(bookings.map((booking) => booking?.status)).toEqual([
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CONFIRMED,
  ]);

  const ordersReport = await shop.actor.call("get", `/orgs/${shop.organizationId}/orders`);
  expect(ordersReport.status).toBe(200);
  const orderRow = requirePresent(
    (ordersReport.body.data as readonly { orderId: string; grandTotal: { amount: number } }[]).find(
      (row) => row.orderId === orderLink.requestId,
    ),
    "orders report row",
  );
  expect(orderRow.grandTotal.amount).toBe(orderLink.paymentRequired.amount);

  const bookingsReport = await shop.actor.call("get", `/orgs/${shop.organizationId}/bookings`);
  expect(bookingsReport.status).toBe(200);
  const reportedBookingIds = (bookingsReport.body.data as readonly { bookingId: string }[]).map(
    (row) => row.bookingId,
  );
  expect(bookingLinks.every((link) => reportedBookingIds.includes(link.requestId))).toBe(true);

  const enrollmentsReport = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/enrollments`,
  );
  expect(enrollmentsReport.status).toBe(200);
  expect(
    (enrollmentsReport.body.data as readonly { enrollmentId: string }[]).some(
      (row) => row.enrollmentId === enrollmentLink.requestId,
    ),
  ).toBe(true);
}

function winnerOfRace(resA: Response, resB: Response, loserCode: string): Response {
  expect([resA.status, resB.status].filter((status) => status === 201)).toHaveLength(1);
  const loser = resA.status === 201 ? resB : resA;
  expect(loser.status).toBe(409);
  expect(loser.body.error.code).toBe(loserCode);
  return resA.status === 201 ? resA : resB;
}

async function slotUsedByBucket(
  organizationId: string,
  resourceId: string,
  startsAt: string,
  blockedEndsAt: string,
): Promise<Map<number, number>> {
  return runInOrganizationContext(organizationId, () =>
    new MongoResourceSlotUsageRepository().readUsedByBucket({
      organizationId: asId<OrganizationId>(organizationId),
      resourceId: asId<ResourceId>(resourceId),
      startsAt: new Date(startsAt),
      blockedEndsAt: new Date(blockedEndsAt),
    }),
  );
}

function maxSlotUsed(used: Map<number, number>): number {
  return Math.max(0, ...used.values());
}

async function eventSeatsSold(organizationId: string, eventSessionId: string): Promise<number> {
  const session = await runInOrganizationContext(organizationId, () =>
    new MongoEventSessionRepository().findById(asId<EventSessionId>(eventSessionId)),
  );
  return session?.toProps().seatsSold ?? -1;
}

async function readCheckoutDetail(
  shop: ShopWorld,
  checkoutId: string,
  cookies: Record<string, string>,
): Promise<CheckoutDetailResponse> {
  const response = await callStorefront(harness.app, {
    method: "get",
    organizationId: shop.organizationId,
    suffix: `/checkouts/${checkoutId}`,
    cookies,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data as CheckoutDetailResponse;
}

async function runExpireHoldsJob(): Promise<void> {
  const expireJob = requirePresent(jobRegistry.find("booking.expireHolds"), "booking.expireHolds");
  const expiryClock = {
    now: () => new Date(harness.clock.now().getTime() + 60 * 60_000),
  };
  await runScheduledJob(expireJob, { clock: expiryClock, effectiveness: ALWAYS_EFFECTIVE });
}

describe("Storefront Commerce Scenarios (Card 4.3 Part V)", () => {
  it("quote and checkout all five kinds together, then dispatch the real outbox and read the accounting and report surfaces", async () => {
    const shop = await commerceShop();
    const catalog = await buildMixedCatalog(shop);
    const guest = await newGuest(shop.organizationId);

    const quoted = await quote(shop, guest, catalog.selections);
    assertMixedQuoteTotals(quoted);

    const response = await submitCheckout(shop, guest, quoted.quoteId, {
      name: "Bashir Ahmed",
      phone: "+8801700000001",
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const checkout = response.body.data as CheckoutResponse;
    expect(checkout.requests).toHaveLength(5);
    expect(checkout.requests.find((link) => link.requestType === "ORDER")?.status).toBe("PLACED");
    expect(checkout.requests.filter((link) => link.requestType === "BOOKING")).toHaveLength(3);
    expect(checkout.requests.find((link) => link.requestType === "ENROLLMENT")?.status).toBe(
      "PENDING",
    );

    const jobs = await dispatchAndDeliverThisOrg(shop.organizationId);
    await assertOutboxDelivery(shop, checkout, jobs);
    await assertReportsAndAccounting(shop, checkout);
  });

  it("lets exactly one guest win the last product unit", async () => {
    const shop = await commerceShop();
    const itemId = await addInventoryItem(shop, "Exclusive Jacket");
    await receiveStock(shop, [{ inventoryItemId: itemId, quantity: 1, unitCostAmount: 500 }]);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Exclusive Jacket",
      priceAmount: 8000,
      stockComponents: [{ inventoryItemId: itemId, quantity: 1 }],
    });
    const selection = [productSelection(product, 1, "sel-last-stock")];
    const guestA = await newGuest(shop.organizationId);
    const guestB = await newGuest(shop.organizationId);
    const [quoteA, quoteB] = await Promise.all([
      quote(shop, guestA, selection),
      quote(shop, guestB, selection),
    ]);
    const [resA, resB] = await Promise.all([
      submitCheckout(shop, guestA, quoteA.quoteId, { name: "Buyer A", phone: "+8801700000002" }),
      submitCheckout(shop, guestB, quoteB.quoteId, { name: "Buyer B", phone: "+8801700000003" }),
    ]);
    winnerOfRace(resA, resB, ERROR_CODE.INSUFFICIENT_STOCK);
    const level = await levelOf(shop, itemId);
    expect(level.onHand).toBe(1);
    expect(level.reserved).toBe(1);
  });

  it("lets exactly one guest win the last event seat", async () => {
    const shop = await commerceShop();
    const eventOffering = await publishBookableEvent(shop.actor, shop.organizationId, {
      name: "Intimate Concert",
      unitPriceAmount: 5000,
    });
    const variantId = variantOf(eventOffering);
    const eventSessionId = await createEventSession(shop, eventOffering, variantId, 1);
    const selection: CheckoutSelection[] = [
      {
        selectionId: "sel-last-seat",
        selection: {
          kind: "EVENT",
          offeringId: eventOffering.offeringId,
          variantId,
          eventSessionId,
          quantity: 1,
        },
        customFields: {},
      },
    ];
    const guestA = await newGuest(shop.organizationId);
    const guestB = await newGuest(shop.organizationId);
    const [quoteA, quoteB] = await Promise.all([
      quote(shop, guestA, selection),
      quote(shop, guestB, selection),
    ]);
    const [resA, resB] = await Promise.all([
      submitCheckout(shop, guestA, quoteA.quoteId, { name: "Audience 1", phone: "+8801700000004" }),
      submitCheckout(shop, guestB, quoteB.quoteId, { name: "Audience 2", phone: "+8801700000005" }),
    ]);
    winnerOfRace(resA, resB, ERROR_CODE.SLOT_UNAVAILABLE);
    expect(await eventSeatsSold(shop.organizationId, eventSessionId)).toBe(1);
  });

  it("lets exactly one guest win an overlapping rental on the same hall", async () => {
    const shop = await commerceShop();
    const rentalOffering = await publishBookableRental(shop.actor, shop.organizationId, {
      name: "Hall rental",
      rateUnit: "HOUR",
      minUnits: 1,
      resourceTypeKeys: ["STYLIST"],
      unitPriceAmount: 2000,
    });
    const hallId = await createHall(harness, shop.actor, {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      offeringIds: [rentalOffering.offeringId],
      capacity: 1,
      name: "Only Hall",
    });
    const variantId = variantOf(rentalOffering);
    const selection: CheckoutSelection[] = [
      {
        selectionId: "sel-overlap",
        selection: {
          kind: "RENTAL",
          offeringId: rentalOffering.offeringId,
          variantId,
          startsAt: SUNDAY_RENTAL_START,
          endsAt: SUNDAY_RENTAL_END,
          resourceIds: [hallId],
        },
        customFields: {},
      },
    ];
    const guestA = await newGuest(shop.organizationId);
    const guestB = await newGuest(shop.organizationId);
    const [quoteA, quoteB] = await Promise.all([
      quote(shop, guestA, selection),
      quote(shop, guestB, selection),
    ]);
    const [resA, resB] = await Promise.all([
      submitCheckout(shop, guestA, quoteA.quoteId, { name: "Renter A", phone: "+8801700000006" }),
      submitCheckout(shop, guestB, quoteB.quoteId, { name: "Renter B", phone: "+8801700000007" }),
    ]);
    winnerOfRace(resA, resB, ERROR_CODE.SLOT_UNAVAILABLE);
    expect(
      maxSlotUsed(
        await slotUsedByBucket(shop.organizationId, hallId, SUNDAY_RENTAL_START, SUNDAY_RENTAL_END),
      ),
    ).toBe(1);
  });

  it("confirms a deposit-paid hold and expires an unpaid hold once through the real worker", async () => {
    const shop = await commerceShop();
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, DEPOSIT_MINOR);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, HOLD_MINUTES);
    const serviceOffering = await publishBookableService(shop.actor, shop.organizationId);
    const hallId = await createHall(harness, shop.actor, {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      offeringIds: [serviceOffering.offeringId],
      capacity: 1,
      name: "Consultant 1",
    });
    const variantId = variantOf(serviceOffering);

    function selectionAt(startsAt: string, selectionId: string): CheckoutSelection[] {
      return [
        {
          selectionId,
          selection: {
            kind: "SERVICE",
            offeringId: serviceOffering.offeringId,
            variantId,
            startsAt,
            resourceIds: [hallId],
          },
          customFields: {},
        },
      ];
    }

    const guestPaid = await newGuest(shop.organizationId);
    const paidQuote = await quote(shop, guestPaid, selectionAt(SUNDAY_SERVICE_START, "sel-paid"));
    const paidResponse = await submitCheckout(shop, guestPaid, paidQuote.quoteId, {
      name: "Client Paid",
      phone: "+8801700000008",
    });
    expect(paidResponse.status, JSON.stringify(paidResponse.body)).toBe(201);
    const paidCheckout = paidResponse.body.data as CheckoutResponse;
    const paidBooking = requirePresent(paidCheckout.requests[0], "paid booking request");
    expect(paidBooking.requestType).toBe("BOOKING");
    expect(paidBooking.status).toBe(BOOKING_STATUS.HELD);
    expect(paidBooking.holdExpiresAt).toBeDefined();
    const payableBefore = requirePresent(
      (await readCheckoutDetail(shop, paidCheckout.checkoutId, guestPaid)).requests[0],
      "paid tracking request",
    ).paymentRequired.amount;

    const guestUnpaid = await newGuest(shop.organizationId);
    const unpaidQuote = await quote(
      shop,
      guestUnpaid,
      selectionAt(UNPAID_HOLD_START, "sel-unpaid"),
    );
    const unpaidResponse = await submitCheckout(shop, guestUnpaid, unpaidQuote.quoteId, {
      name: "Client Unpaid",
      phone: "+8801700000009",
    });
    expect(unpaidResponse.status, JSON.stringify(unpaidResponse.body)).toBe(201);
    const unpaidBooking = requirePresent(
      (unpaidResponse.body.data as CheckoutResponse).requests[0],
      "unpaid booking request",
    );
    expect(unpaidBooking.status).toBe(BOOKING_STATUS.HELD);

    const { receivePayment } = buildPaymentStack();
    const bookingRepo = new MongoBookingRepository();
    const paidBookingRow = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(paidBooking.requestId)),
    );
    expect(paidBookingRow?.contactId).toBeDefined();
    await runInOrganizationContext(shop.organizationId, () =>
      receivePayment.execute({
        organizationId: asId(shop.organizationId),
        locationId: asId(shop.locationId),
        method: PAYMENT_METHOD.CASH,
        amount: { amount: DEPOSIT_MINOR, currency: CURRENCY_CODE.BDT },
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: paidBooking.requestId,
            amount: { amount: DEPOSIT_MINOR, currency: CURRENCY_CODE.BDT },
          },
        ],
        contactId: paidBookingRow?.contactId ?? null,
        receivedByMemberId: newId(),
        actorUserId: null,
      }),
    );
    const confirmed = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(paidBooking.requestId)),
    );
    expect(confirmed?.status).toBe(BOOKING_STATUS.CONFIRMED);
    const summary = await runInOrganizationContext(shop.organizationId, () =>
      new MongoPaymentSummaryRepository().findByRequest(
        asId(shop.organizationId),
        PAYMENT_REQUEST_TYPE.BOOKING,
        paidBooking.requestId,
      ),
    );
    expect(summary?.allocated.amount).toBe(DEPOSIT_MINOR);
    const payableAfter = requirePresent(
      (await readCheckoutDetail(shop, paidCheckout.checkoutId, guestPaid)).requests[0],
      "paid tracking after deposit",
    ).paymentRequired.amount;
    expect(payableAfter).toBe(payableBefore - DEPOSIT_MINOR);

    await runExpireHoldsJob();
    const stillConfirmed = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(paidBooking.requestId)),
    );
    expect(stillConfirmed?.status).toBe(BOOKING_STATUS.CONFIRMED);
    const expiredOnce = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(unpaidBooking.requestId)),
    );
    expect(expiredOnce?.status).toBe(BOOKING_STATUS.EXPIRED);
    expect(
      maxSlotUsed(
        await slotUsedByBucket(shop.organizationId, hallId, UNPAID_HOLD_START, UNPAID_HOLD_END),
      ),
    ).toBe(0);
    expect(
      maxSlotUsed(
        await slotUsedByBucket(
          shop.organizationId,
          hallId,
          SUNDAY_SERVICE_START,
          SERVICE_START_END,
        ),
      ),
    ).toBe(1);

    const versionAfterFirst = requirePresent(expiredOnce, "expired booking").version;
    await runExpireHoldsJob();
    const expiredTwice = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(unpaidBooking.requestId)),
    );
    expect(expiredTwice?.status).toBe(BOOKING_STATUS.EXPIRED);
    expect(expiredTwice?.version).toBe(versionAfterFirst);
    expect(
      maxSlotUsed(
        await slotUsedByBucket(shop.organizationId, hallId, UNPAID_HOLD_START, UNPAID_HOLD_END),
      ),
    ).toBe(0);
  });

  it("claims a guest checkout into a verified account over real OTP sign-in and revokes guest access", async () => {
    const shop = await commerceShop();
    const itemId = await addInventoryItem(shop, "Book");
    await receiveStock(shop, [{ inventoryItemId: itemId, quantity: 10, unitCostAmount: 100 }]);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Novel",
      priceAmount: 1200,
      stockComponents: [{ inventoryItemId: itemId, quantity: 1 }],
    });
    const phoneLocal = freshPhone();
    const phoneE164 = `+88${phoneLocal}`;
    const guest = await newGuest(shop.organizationId);
    const quoted = await quote(shop, guest, [productSelection(product, 1, "sel-book")]);
    const idempotencyKey = newId();
    const body = { quoteId: quoted.quoteId, contact: { name: "Rahim", phone: phoneE164 } };

    const checkoutResponse = await callStorefront(harness.app, {
      method: "post",
      organizationId: shop.organizationId,
      suffix: "/checkout",
      body,
      cookies: guest,
      idempotencyKey,
    });
    expect(checkoutResponse.status, JSON.stringify(checkoutResponse.body)).toBe(201);
    const checkout = checkoutResponse.body.data as CheckoutResponse;
    const orderLink = requirePresent(
      checkout.requests.find((link) => link.requestType === "ORDER"),
      "order link",
    );

    const guestRead = await callStorefront(harness.app, {
      method: "get",
      organizationId: shop.organizationId,
      suffix: `/checkouts/${checkout.checkoutId}`,
      cookies: guest,
    });
    expect(guestRead.status).toBe(200);

    await enableCustomerLogin(shop.world, shop.organizationId);
    const signedIn = await signInCustomer(harness, shop.organizationId, phoneLocal);
    const customerAccountId = signedIn.verifyResponse.body.data["customerAccountId"] as string;
    expect(customerAccountId).toBeDefined();

    const claimResponse = await callStorefront(harness.app, {
      method: "post",
      organizationId: shop.organizationId,
      suffix: `/checkouts/${checkout.checkoutId}/claim`,
      cookies: { ...guest, ...asCustomerCookies(signedIn.session) },
    });
    expect(claimResponse.status, JSON.stringify(claimResponse.body)).toBe(200);
    expect(claimResponse.body.data.success).toBe(true);
    expect(claimResponse.body.data.customerAccountId).toBe(customerAccountId);

    const guestTracking = await callStorefront(harness.app, {
      method: "get",
      organizationId: shop.organizationId,
      suffix: `/checkouts/${checkout.checkoutId}`,
      cookies: guest,
    });
    expect(guestTracking.status).toBe(404);

    const guestList = await callStorefront(harness.app, {
      method: "get",
      organizationId: shop.organizationId,
      suffix: "/me/requests",
      cookies: guest,
    });
    expect(guestList.status).toBe(200);
    expect(guestList.body.data.items).toHaveLength(0);

    const replay = await callStorefront(harness.app, {
      method: "post",
      organizationId: shop.organizationId,
      suffix: "/checkout",
      body,
      cookies: guest,
      idempotencyKey,
    });
    expect(replay.status).toBe(403);

    const customerList = await callStorefront(harness.app, {
      method: "get",
      organizationId: shop.organizationId,
      suffix: "/me/requests",
      cookies: asCustomerCookies(signedIn.session),
    });
    expect(customerList.status).toBe(200);
    expect(
      (customerList.body.data.items as readonly { requestId: string }[]).some(
        (row) => row.requestId === orderLink.requestId,
      ),
    ).toBe(true);

    const claimedRows = await outboxRows(shop.organizationId, WEBSITE_EVENT_TYPE.CHECKOUT_CLAIMED);
    expect(
      claimedRows.some(
        (row) => (row.payload as { checkoutId: string }).checkoutId === checkout.checkoutId,
      ),
    ).toBe(true);
  });

  it("submits a signed-in checkout and replays the same Idempotency-Key", async () => {
    const shop = await commerceShop();
    const itemId = await addInventoryItem(shop, "Notebook");
    await receiveStock(shop, [{ inventoryItemId: itemId, quantity: 5, unitCostAmount: 50 }]);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Notebook",
      priceAmount: 900,
      stockComponents: [{ inventoryItemId: itemId, quantity: 1 }],
    });
    await enableCustomerLogin(shop.world, shop.organizationId);
    const signedIn = await signInCustomer(harness, shop.organizationId);
    const cookies = asCustomerCookies(signedIn.session);
    const quoted = await quote(shop, cookies, [productSelection(product, 1, "sel-signed-in")]);
    const idempotencyKey = newId();
    const first = await submitCheckout(
      shop,
      cookies,
      quoted.quoteId,
      { name: "Signed In", phone: `+88${signedIn.phone}` },
      idempotencyKey,
    );
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const firstCheckout = first.body.data as CheckoutResponse;
    const replay = await submitCheckout(
      shop,
      cookies,
      quoted.quoteId,
      { name: "Signed In", phone: `+88${signedIn.phone}` },
      idempotencyKey,
    );
    expect(replay.status, JSON.stringify(replay.body)).toBe(201);
    expect((replay.body.data as CheckoutResponse).checkoutId).toBe(firstCheckout.checkoutId);
  });

  it("rejects a foreign guest cookie for SERVICE quotes and checkout on a configured second tenant", async () => {
    const shopA = await commerceShop();
    const shopB = await commerceShop();
    const serviceOffering = await publishBookableService(shopB.actor, shopB.organizationId);
    const resourceId = await createHall(harness, shopB.actor, {
      organizationId: shopB.organizationId,
      locationId: shopB.locationId,
      offeringIds: [serviceOffering.offeringId],
      capacity: 1,
      name: "Tenant B Stylist",
    });
    const service = {
      offeringId: serviceOffering.offeringId,
      variantId: variantOf(serviceOffering),
    };
    const selection: CheckoutSelection[] = [
      {
        selectionId: "sel-service-foreign-guest",
        selection: {
          kind: "SERVICE",
          ...service,
          startsAt: SUNDAY_SERVICE_START,
          resourceIds: [resourceId],
        },
        customFields: {},
      },
    ];
    const guestA = await newGuest(shopA.organizationId);
    const guestB = await newGuest(shopB.organizationId);
    const ownQuote = await quote(shopB, guestB, selection);
    const foreignQuote = await callStorefront(harness.app, {
      method: "post",
      organizationId: shopB.organizationId,
      suffix: "/quotes",
      body: {
        locationId: shopB.locationId,
        selections: selection,
        fulfillment: { method: "PICKUP" },
      },
      cookies: guestA,
    });
    expect(foreignQuote.status).toBe(401);
    expect(foreignQuote.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);

    const foreignSubmit = await submitCheckout(shopB, guestA, ownQuote.quoteId, {
      name: "Foreign Guest",
      phone: "+8801700000101",
    });
    expect(foreignSubmit.status).toBe(401);
    expect(foreignSubmit.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);
  });

  it("refuses SERVICE quotes and saved quote submissions after its location leaves the public list", async () => {
    const shop = await commerceShop();
    const serviceOffering = await publishBookableService(shop.actor, shop.organizationId);
    const resourceId = await createHall(harness, shop.actor, {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      offeringIds: [serviceOffering.offeringId],
      capacity: 1,
      name: "Public List Stylist",
    });
    const locationB = shop.world.locationA2;
    const service = {
      offeringId: serviceOffering.offeringId,
      variantId: variantOf(serviceOffering),
    };
    const selection: CheckoutSelection[] = [
      {
        selectionId: "sel-service-location-revoked",
        selection: {
          kind: "SERVICE",
          ...service,
          startsAt: SUNDAY_SERVICE_START,
          resourceIds: [resourceId],
        },
        customFields: {},
      },
    ];
    await setSetting(shop, WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY, [shop.locationId, locationB]);
    const guest = await newGuest(shop.organizationId);
    const validQuote = await quote(shop, guest, selection);
    const usageBefore = await slotUsedByBucket(
      shop.organizationId,
      resourceId,
      SUNDAY_SERVICE_START,
      SERVICE_START_END,
    );
    const bookingsBefore = await tenantDocumentCount(shop.organizationId, BOOKING_MODEL_NAME);
    const checkoutsBefore = await tenantDocumentCount(shop.organizationId, CHECKOUT_MODEL_NAME);

    const publicListUpdated = await shop.actor.call(
      "patch",
      `/orgs/${shop.organizationId}/settings`,
      {
        items: [
          { settingKey: WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY, value: [locationB], version: 1 },
        ],
      },
    );
    expect(publicListUpdated.status, JSON.stringify(publicListUpdated.body)).toBe(200);
    const newQuote = await callStorefront(harness.app, {
      method: "post",
      organizationId: shop.organizationId,
      suffix: "/quotes",
      body: {
        locationId: shop.locationId,
        selections: selection,
        fulfillment: { method: "PICKUP" },
      },
      cookies: guest,
    });
    expect(newQuote.status).toBe(400);
    expect(newQuote.body.error.code).toBe(ERROR_CODE.CHECKOUT_LOCATION_MISMATCH);

    const savedQuoteSubmit = await submitCheckout(
      shop,
      guest,
      validQuote.quoteId,
      { name: "Location Change", phone: "+8801700000102" },
      newId(),
    );
    expect(savedQuoteSubmit.status).toBe(400);
    expect(savedQuoteSubmit.body.error.code).toBe(ERROR_CODE.CHECKOUT_LOCATION_MISMATCH);
    expect(await tenantDocumentCount(shop.organizationId, BOOKING_MODEL_NAME)).toBe(bookingsBefore);
    expect(await tenantDocumentCount(shop.organizationId, CHECKOUT_MODEL_NAME)).toBe(
      checkoutsBefore,
    );
    expect(
      await slotUsedByBucket(
        shop.organizationId,
        resourceId,
        SUNDAY_SERVICE_START,
        SERVICE_START_END,
      ),
    ).toEqual(usageBefore);
  });

  it("replays a capacity-one SERVICE checkout once and removes its held slot from availability", async () => {
    const shop = await commerceShop();
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, DEPOSIT_MINOR);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, HOLD_MINUTES);
    const serviceOffering = await publishBookableService(shop.actor, shop.organizationId);
    const resourceId = await createHall(harness, shop.actor, {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      offeringIds: [serviceOffering.offeringId],
      capacity: 1,
      name: "Replay Stylist",
    });
    const service = {
      offeringId: serviceOffering.offeringId,
      variantId: variantOf(serviceOffering),
    };
    const availableBefore = await serviceAvailability(shop, service, shop.locationId);
    expect(availableBefore.status).toBe(200);
    const startsAt = String(availableBefore.body.data.days[0]?.slots[0]?.startsAt ?? "");
    expect(startsAt).not.toBe("");
    const selection: CheckoutSelection[] = [
      {
        selectionId: "sel-service-replay",
        selection: { kind: "SERVICE", ...service, startsAt, resourceIds: [resourceId] },
        customFields: {},
      },
    ];
    const guest = await newGuest(shop.organizationId);
    const quoted = await quote(shop, guest, selection);
    const key = newId();
    const contact = { name: "Replay Client", phone: "+8801700000103" };
    const first = await submitCheckout(shop, guest, quoted.quoteId, contact, key);
    const replay = await submitCheckout(shop, guest, quoted.quoteId, contact, key);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(replay.status, JSON.stringify(replay.body)).toBe(201);
    expect(replay.body.data).toEqual(first.body.data);
    const checkout = first.body.data as CheckoutResponse;
    const booking = requirePresent(checkout.requests[0], "replayed booking");
    expect(booking.status).toBe(BOOKING_STATUS.HELD);
    expect(booking.holdExpiresAt).toBeDefined();
    expect(checkout.checkoutId).toBe((replay.body.data as CheckoutResponse).checkoutId);
    expect((replay.body.data as CheckoutResponse).requests[0]?.requestId).toBe(booking.requestId);
    expect(await tenantDocumentCount(shop.organizationId, CHECKOUT_MODEL_NAME)).toBe(1);
    expect(await tenantDocumentCount(shop.organizationId, BOOKING_MODEL_NAME)).toBe(1);
    expect(
      maxSlotUsed(
        await slotUsedByBucket(shop.organizationId, resourceId, startsAt, SERVICE_START_END),
      ),
    ).toBe(1);

    const availableAfter = await serviceAvailability(shop, service, shop.locationId);
    expect(availableAfter.status).toBe(200);
    const remainingSlots = (
      availableAfter.body.data.days as readonly { slots: readonly { startsAt: string }[] }[]
    ).flatMap((day) => day.slots);
    expect(remainingSlots.some((slot) => slot.startsAt === startsAt)).toBe(false);
  });

  it("refuses a guest cookie from another organization and a location not on the public list", async () => {
    const shop = await commerceShop();
    const itemId = await addInventoryItem(shop, "Pen");
    await receiveStock(shop, [{ inventoryItemId: itemId, quantity: 5, unitCostAmount: 10 }]);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Pen",
      priceAmount: 300,
      stockComponents: [{ inventoryItemId: itemId, quantity: 1 }],
    });
    const guestA = await newGuest(shop.organizationId);
    const crossOrg = await callStorefront(harness.app, {
      method: "post",
      organizationId: shop.world.organizationB,
      suffix: "/quotes",
      body: {
        locationId: shop.world.locationB1,
        selections: [productSelection(product, 1, "sel-cross-org")],
        fulfillment: { method: "PICKUP" },
      },
      cookies: guestA,
    });
    expect(crossOrg.status).toBe(401);
    expect(crossOrg.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);

    await setSetting(shop, WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY, [shop.locationId]);
    const foreignLocation = await callStorefront(harness.app, {
      method: "post",
      organizationId: shop.organizationId,
      suffix: "/quotes",
      body: {
        locationId: shop.world.locationA2,
        selections: [productSelection(product, 1, "sel-foreign-location")],
        fulfillment: { method: "PICKUP" },
      },
      cookies: guestA,
    });
    expect(foreignLocation.status).toBe(400);
    expect(foreignLocation.body.error.code).toBe(ERROR_CODE.CHECKOUT_LOCATION_MISMATCH);
  });

  it("keeps the Track M directory storefront reads working", async () => {
    const world = await worldFor(harness, MATRIMONY);
    await enableDirectoryForWorld(world);
    const stats = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/directory/stats",
    });
    expect(stats.status).toBe(200);
    expect(stats.body.data).toHaveProperty("field");
    expect(stats.body.data.field).not.toBeNull();
  });
});
