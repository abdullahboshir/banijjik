import {
  CURRENCY_CODE,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
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
import {
  SF_GUEST_COOKIE_NAME,
  WEBSITE_CHECKOUT_ENABLED_SETTING_KEY,
  WEBSITE_EVENT_TYPE,
  type CheckoutResponse,
  type CheckoutSelection,
  type PublicQuoteResponse,
} from "@banijjik/contracts/website";
import { asId, newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { MongoUnitOfWork, models } from "../../../kernel/db/index.js";
import { eventHandlerRegistry, kernelEventPublisher } from "../../../kernel/events/index.js";
import type { EventJobData, EventJobQueue } from "../../../kernel/events/event-job.js";
import { OutboxDispatcher } from "../../../kernel/events/outbox-dispatcher.js";
import {
  OUTBOX_EVENT_MODEL_NAME,
  type OutboxEventDocument,
} from "../../../kernel/events/outbox-event.schema.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { systemClock } from "../../../kernel/time/index.js";
import { MODULE_MANIFESTS, buildModuleRegistry } from "../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../routes/organization-config-ports.js";
import {
  buildPaymentRequestLifecycles,
  buildPaymentRequestReaders,
} from "../../../routes/payment-request-readers.js";
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
  buildExpireHoldsJob,
  buildOrganizationTimezoneReader,
  MongoBookingRepository,
} from "../booking/index.js";
import { buildOrderSnapshotReader } from "../sales/index.js";
import {
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  ReceivePaymentUseCase,
} from "../payment/index.js";
import { buildOrgConfigService } from "../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../platform/industry/index.js";

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

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
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
});

afterAll(async () => {
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

async function grantAllCommerceModules(organizationId: string): Promise<void> {
  const modulesToGrant = [
    MODULE_KEY.WEBSITE,
    MODULE_KEY.SALES,
    MODULE_KEY.BOOKING,
    MODULE_KEY.ENROLLMENT,
    MODULE_KEY.CREDIT,
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
      admissionFee: money(1000),
      securityDeposit: money(2000),
    },
    variants: [{ name: "Standard", price: money(5000), unitKey: "SESSION" }],
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

function outboxRows(organizationId: string, type: string) {
  return runInOrganizationContext(organizationId, () =>
    models({})
      .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
      .find({ organizationId, type })
      .lean<OutboxEventDocument[]>(),
  );
}

function buildPaymentStack() {
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: harness.clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(harness.clock),
  });
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
    priceAmount: 2500,
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
    unitPriceAmount: 3000,
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
    unitPriceAmount: 4000,
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
    event: {
      offeringId: eventOffering.offeringId,
      variantId: eventVariantId,
      eventSessionId,
    },
    plan,
    selections: [
      productSelection(product, 2),
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

describe("Storefront Commerce Scenarios (Card 4.3 Part V)", () => {
  it("quote and checkout all five kinds together, then dispatch the real outbox and read the accounting and report surfaces", async () => {
    const shop = await commerceShop();
    const catalog = await buildMixedCatalog(shop);
    const guest = await newGuest(shop.organizationId);

    const quoted = await quote(shop, guest, catalog.selections);
    expect(quoted.lines).toHaveLength(5);
    expect(quoted.total.amount).toBeGreaterThan(0);

    const response = await submitCheckout(shop, guest, quoted.quoteId, {
      name: "Bashir Ahmed",
      phone: "+8801700000001",
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const checkout = response.body.data as CheckoutResponse;
    expect(checkout.requests).toHaveLength(5);

    const orderLink = checkout.requests.find((link) => link.requestType === "ORDER");
    expect(orderLink).toBeDefined();
    expect(orderLink?.status).toBe("PLACED");
    const bookingLinks = checkout.requests.filter((link) => link.requestType === "BOOKING");
    expect(bookingLinks).toHaveLength(3);
    const enrollmentLink = checkout.requests.find((link) => link.requestType === "ENROLLMENT");
    expect(enrollmentLink?.status).toBe("PENDING");

    const createdRows = await outboxRows(shop.organizationId, WEBSITE_EVENT_TYPE.CHECKOUT_CREATED);
    expect(
      createdRows.some(
        (row) => (row.payload as { checkoutId: string }).checkoutId === checkout.checkoutId,
      ),
    ).toBe(true);

    const queue = new RecordingQueue();
    const dispatcher = new OutboxDispatcher({
      queue,
      registry: eventHandlerRegistry,
      clock: systemClock,
    });
    const handled = await dispatcher.dispatchBatch();
    expect(handled).toBeGreaterThanOrEqual(1);
    const dispatched = await outboxRows(shop.organizationId, WEBSITE_EVENT_TYPE.CHECKOUT_CREATED);
    expect(dispatched.every((row) => row.status === "DISPATCHED")).toBe(true);

    const orderReader = buildOrderSnapshotReader();
    const order = await runInOrganizationContext(shop.organizationId, () =>
      orderReader.read(asId(requirePresent(orderLink, "order link").requestId)),
    );
    expect(order?.status).toBe("PLACED");
    expect(order?.totals.grandTotal.amount).toBe(orderLink?.paymentRequired.amount);

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
    expect(
      (ordersReport.body.data as readonly { orderId: string }[]).some(
        (row) => row.orderId === orderLink?.requestId,
      ),
    ).toBe(true);

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
        (row) => row.enrollmentId === enrollmentLink?.requestId,
      ),
    ).toBe(true);
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

    expect([resA.status, resB.status].filter((status) => status === 201)).toHaveLength(1);
    expect([resA.status, resB.status].filter((status) => status !== 201)).toEqual([409]);
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

    expect([resA.status, resB.status].filter((status) => status === 201)).toHaveLength(1);
    expect([resA.status, resB.status].filter((status) => status !== 201)).toEqual([409]);
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

    expect([resA.status, resB.status].filter((status) => status === 201)).toHaveLength(1);
    expect([resA.status, resB.status].filter((status) => status !== 201)).toEqual([409]);
  });

  it("confirms a deposit-paid hold and expires an unpaid hold once through the real worker", async () => {
    const shop = await commerceShop();
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 1000);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, 15);
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

    const guestUnpaid = await newGuest(shop.organizationId);
    const unpaidQuote = await quote(
      shop,
      guestUnpaid,
      selectionAt("2026-11-01T05:30:00.000Z", "sel-unpaid"),
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

    const { unitOfWork, receivePayment } = buildPaymentStack();
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
        amount: { amount: 1000, currency: CURRENCY_CODE.BDT },
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: paidBooking.requestId,
            amount: { amount: 1000, currency: CURRENCY_CODE.BDT },
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

    const expireJob = buildExpireHoldsJob({
      bookings: bookingRepo,
      slots: new MongoResourceSlotUsageRepository(),
      sessions: new MongoEventSessionRepository(),
      unitOfWork,
      events: kernelEventPublisher,
      clock: harness.clock,
    });
    const futureDate = new Date(harness.clock.now().getTime() + 60 * 60_000);
    await runInOrganizationContext(shop.organizationId, () =>
      expireJob.run(shop.organizationId, futureDate),
    );

    const stillConfirmed = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(paidBooking.requestId)),
    );
    expect(stillConfirmed?.status).toBe(BOOKING_STATUS.CONFIRMED);
    const expired = await runInOrganizationContext(shop.organizationId, () =>
      bookingRepo.findById(asId(unpaidBooking.requestId)),
    );
    expect(expired?.status).toBe(BOOKING_STATUS.EXPIRED);
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
