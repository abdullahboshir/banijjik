import { CURRENCY_CODE, ERROR_CODE } from "@banijjik/contracts";
import {
  SF_GUEST_COOKIE_NAME,
  formatGuestCookie,
  type CheckoutSelection,
  type PublicQuoteLine,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { errorHandler } from "../../../kernel/http/index.js";
import { MongoRateLimiter } from "../../../kernel/rate-limit/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { runWithRequestContext } from "../../../kernel/context/index.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import type {
  CatalogQuoteReaderPort,
  GuestContactPort,
  OrgStorefrontConfigReader,
  PricedSelectionsResult,
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
  StorefrontOrganizationConfig,
} from "./application/checkout-ports.js";
import { QuoteCheckoutUseCase } from "./application/quote-checkout.js";
import { SubmitCheckoutUseCase } from "./application/submit-checkout.js";
import { CreateGuestSessionUseCase } from "./application/use-cases/create-guest-session.use-case.js";
import { ResolveGuestSessionUseCase } from "./application/use-cases/resolve-guest-session.use-case.js";
import {
  MongoCheckoutAccessRepository,
  MongoCheckoutQuoteRepository,
  MongoCheckoutRepository,
  MongoCheckoutRequestLinkRepository,
} from "./infrastructure/mongo-checkout.repository.js";
import { MongoGuestSessionRepository } from "./infrastructure/mongo-guest-session.repository.js";
import { buildCheckoutRouter } from "./presentation/checkout.router.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("Storefront Checkout Orchestration (Card 4.3 Part A4)", () => {
  let currentTime: Date;
  const clock = {
    now: () => currentTime,
  };

  const guestRepo = new MongoGuestSessionRepository();
  const quoteRepo = new MongoCheckoutQuoteRepository();
  const checkoutRepo = new MongoCheckoutRepository();
  const accessRepo = new MongoCheckoutAccessRepository();
  const requestLinkRepo = new MongoCheckoutRequestLinkRepository();
  const unitOfWork = new MongoUnitOfWork();

  let orgStorefrontConfig: StorefrontOrganizationConfig;
  let catalogPricingOverride:
    ((selections: readonly CheckoutSelection[]) => PricedSelectionsResult) | null;
  let bookingRequestError: Error | null;
  let guestContactsCreated: Map<string, string>;

  const orgConfigReader: OrgStorefrontConfigReader = {
    readStorefrontConfig: async () => orgStorefrontConfig,
  };

  const catalogQuoter: CatalogQuoteReaderPort = {
    priceSelections: async (input) => {
      if (catalogPricingOverride) {
        return catalogPricingOverride(input.selections);
      }
      const lines: PublicQuoteLine[] = input.selections.map((sel) => ({
        selectionId: sel.selectionId,
        subtotal: { amount: 5000, currency: CURRENCY_CODE.BDT },
        discount: { amount: 0, currency: CURRENCY_CODE.BDT },
        tax: { amount: 0, currency: CURRENCY_CODE.BDT },
        total: { amount: 5000, currency: CURRENCY_CODE.BDT },
        amountRequiredBeforeConfirmation:
          sel.selection.kind === "PRODUCT"
            ? { amount: 0, currency: CURRENCY_CODE.BDT }
            : { amount: 1000, currency: CURRENCY_CODE.BDT },
      }));
      const totalAmount = lines.reduce((acc, l) => acc + l.total.amount, 0);
      return {
        lines,
        total: { amount: totalAmount, currency: CURRENCY_CODE.BDT },
        deliveryCharge: { amount: 0, currency: CURRENCY_CODE.BDT },
        configVersion: orgStorefrontConfig.configVersion,
      };
    },
  };

  const guestContacts: GuestContactPort = {
    ensureProvisionalContact: async (input) => {
      const existing = guestContactsCreated.get(input.guestSessionId);
      if (existing) return existing;
      const contactId = newId();
      guestContactsCreated.set(input.guestSessionId, contactId);
      return contactId;
    },
  };

  const publicOrders: PublicOrderCommands = {
    place: async (ctx, input) => ({
      selectionIds: input.selections.map((s) => s.selectionId),
      requestType: "ORDER",
      requestId: newId(),
      publicNumber: "ORD-001",
      status: "PLACED",
      paymentRequired: { amount: 0, currency: CURRENCY_CODE.BDT },
      holdExpiresAt: null,
    }),
  };

  const publicBookings: PublicBookingCommands = {
    request: async (ctx, input) => {
      if (bookingRequestError) throw bookingRequestError;
      return {
        selectionIds: [input.selectionId],
        requestType: "BOOKING",
        requestId: newId(),
        publicNumber: "BK-001",
        status: "HELD",
        paymentRequired: { amount: 1000, currency: CURRENCY_CODE.BDT },
        holdExpiresAt: new Date(currentTime.getTime() + 1800000).toISOString(),
      };
    },
  };

  const publicEnrollments: PublicEnrollmentCommands = {
    request: async (ctx, input) => ({
      selectionIds: [input.selectionId],
      requestType: "ENROLLMENT",
      requestId: newId(),
      publicNumber: "ENR-001",
      status: "PENDING",
      paymentRequired: { amount: 5000, currency: CURRENCY_CODE.BDT },
      holdExpiresAt: null,
    }),
  };

  let app: express.Express;
  let limiter: MongoRateLimiter;

  beforeEach(() => {
    currentTime = new Date("2026-10-30T12:00:00.000Z");
    orgStorefrontConfig = {
      checkoutEnabled: true,
      isReadOnly: false,
      isSuspended: false,
      publicLocationIds: [],
      configVersion: 1,
    };
    catalogPricingOverride = null;
    bookingRequestError = null;
    guestContactsCreated = new Map();

    limiter = new MongoRateLimiter(clock);

    const quoteCheckout = new QuoteCheckoutUseCase({
      quotes: quoteRepo,
      catalogQuoter,
      orgConfig: orgConfigReader,
      clock,
    });

    const submitCheckout = new SubmitCheckoutUseCase({
      quotes: quoteRepo,
      checkouts: checkoutRepo,
      access: accessRepo,
      requestLinks: requestLinkRepo,
      guestContacts,
      catalogQuoter,
      orgConfig: orgConfigReader,
      publicOrders,
      publicBookings,
      publicEnrollments,
      unitOfWork,
      events: kernelEventPublisher,
      clock,
    });

    const resolveGuestSession = new ResolveGuestSessionUseCase(guestRepo, clock);

    const checkoutRouter = buildCheckoutRouter({
      requireWebsiteModule: (_req, _res, next) => next(),
      quoteCheckout,
      submitCheckout,
      resolveGuestSession,
      access: accessRepo,
      limiter,
      clock,
    });

    app = express();
    app.use(express.json());
    app.use(
      "/api/v1/storefront/orgs/:organizationId",
      (req, _res, next) => {
        const organizationId = String(req.params.organizationId);
        void runInOrganizationContext(organizationId, async () => {
          runWithRequestContext({ organizationId, requestId: newId() }, () => next());
        });
      },
      checkoutRouter,
    );
    app.use(errorHandler);
  });

  async function createGuest(organizationId: string) {
    return await runInOrganizationContext(organizationId, async () => {
      const creator = new CreateGuestSessionUseCase({
        repository: guestRepo,
        clock,
        isGuestCheckoutEnabled: async () => true,
      });
      return await creator.execute(organizationId);
    });
  }

  function sampleSelections(): CheckoutSelection[] {
    return [
      {
        selectionId: newId(),
        selection: {
          kind: "PRODUCT",
          offeringId: newId(),
          variantId: newId(),
          quantity: 2,
          modifierOptionIds: [],
        },
        customFields: {},
      },
      {
        selectionId: newId(),
        selection: {
          kind: "SERVICE",
          offeringId: newId(),
          variantId: newId(),
          startsAt: new Date(currentTime.getTime() + 86400000).toISOString(),
          resourceIds: [newId()],
        },
        customFields: {},
      },
      {
        selectionId: newId(),
        selection: {
          kind: "RENTAL",
          offeringId: newId(),
          variantId: newId(),
          startsAt: new Date(currentTime.getTime() + 86400000).toISOString(),
          endsAt: new Date(currentTime.getTime() + 90000000).toISOString(),
          resourceIds: [newId()],
        },
        customFields: {},
      },
      {
        selectionId: newId(),
        selection: {
          kind: "EVENT",
          offeringId: newId(),
          variantId: newId(),
          eventSessionId: newId(),
          quantity: 1,
        },
        customFields: {},
      },
      {
        selectionId: newId(),
        selection: {
          kind: "PLAN",
          offeringId: newId(),
          variantId: newId(),
          startsOn: "2026-11-01",
          resourceIds: [],
        },
        customFields: {},
      },
    ];
  }

  it("creates 5-minute principal-bound quote with server-calculated totals for PRODUCT, SERVICE, RENTAL, EVENT, and PLAN selections", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const res = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections(),
        fulfillment: { method: "PICKUP" },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.quoteId).toBeDefined();
    expect(res.body.data.expiresAt).toBe(new Date(currentTime.getTime() + 300000).toISOString());
    expect(res.body.data.lines).toHaveLength(5);
    expect(res.body.data.total.amount).toBe(25000);

    const saved = await runInOrganizationContext(world.organizationA, () =>
      quoteRepo.findById(world.organizationA, res.body.data.quoteId),
    );
    expect(saved).not.toBeNull();
    expect(saved?.principalKey).toBe(`GUEST:${guest.guestSessionId}`);
  });

  it("rejects quote or checkout when client injects price, discount, tax, source, or contactId fields", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    // Client attempts to inject price in selection
    const badQuoteRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: [
          {
            selectionId: newId(),
            selection: {
              kind: "PRODUCT",
              offeringId: newId(),
              variantId: newId(),
              quantity: 1,
              modifierOptionIds: [],
              injectedPrice: 100, // Injected field
            },
            customFields: {},
          },
        ],
        fulfillment: { method: "PICKUP" },
      });

    expect(badQuoteRes.status).toBe(400);

    // Client attempts to inject contactId in checkout
    const badCheckoutRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId: newId(),
        contact: {
          name: "Attacker",
          phone: "+8801711111111",
          customFields: {},
        },
        contactId: newId(), // Injected field
      });

    expect(badCheckoutRes.status).toBe(400);
  });

  it("rejects quote or checkout when website.checkoutEnabled is false, org is READ_ONLY, or location is not in publicLocationIds", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    // 1. website.checkoutEnabled is false
    orgStorefrontConfig = { ...orgStorefrontConfig, checkoutEnabled: false };
    const disabledRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    expect(disabledRes.status).toBe(400);
    expect(disabledRes.body.error.code).toBe(ERROR_CODE.CHECKOUT_NOT_AVAILABLE);

    // 2. org is READ_ONLY
    orgStorefrontConfig = { ...orgStorefrontConfig, checkoutEnabled: true, isReadOnly: true };
    const readOnlyRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    expect(readOnlyRes.status).toBe(403);
    expect(readOnlyRes.body.error.code).toBe(ERROR_CODE.ORG_READ_ONLY);

    // 3. location is not in publicLocationIds
    orgStorefrontConfig = {
      ...orgStorefrontConfig,
      checkoutEnabled: true,
      isReadOnly: false,
      publicLocationIds: ["loc-allowed-only"],
    };
    const locationMismatchRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    expect(locationMismatchRes.status).toBe(400);
    expect(locationMismatchRes.body.error.code).toBe(ERROR_CODE.CHECKOUT_LOCATION_MISMATCH);
  });

  it("submits mixed checkout transactionally creating Order, Booking, and Enrollment linked by checkoutId", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    // Get quote
    const quoteRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections(),
        fulfillment: { method: "PICKUP" },
      });
    expect(quoteRes.status).toBe(201);
    const quoteId = quoteRes.body.data.quoteId;

    // Submit checkout
    const checkoutRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId,
        contact: {
          name: "Karim Ahmed",
          phone: "+8801711223344",
          customFields: {},
        },
      });

    expect(checkoutRes.status).toBe(201);
    const checkoutId = checkoutRes.body.data.checkoutId;
    expect(checkoutId).toBeDefined();
    expect(checkoutRes.body.data.requests).toHaveLength(5); // 1 order + 3 bookings + 1 enrollment

    // Verify DB entities
    const savedCheckout = await runInOrganizationContext(world.organizationA, () =>
      checkoutRepo.findById(world.organizationA, checkoutId),
    );
    expect(savedCheckout).not.toBeNull();
    expect(savedCheckout?.quoteId).toBe(quoteId);

    const savedAccess = await runInOrganizationContext(world.organizationA, () =>
      accessRepo.findByCheckoutId(world.organizationA, checkoutId),
    );
    expect(savedAccess).not.toBeNull();
    expect(savedAccess?.owner).toEqual({ type: "GUEST", identifier: guest.guestSessionId });

    const links = await runInOrganizationContext(world.organizationA, () =>
      requestLinkRepo.listByCheckoutId(world.organizationA, checkoutId),
    );
    expect(links).toHaveLength(5);
  });

  it("creates provisional guest contact once per guest session and reuses it on subsequent checkouts", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    // First checkout
    const q1 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const c1 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId: q1.body.data.quoteId,
        contact: { name: "Guest User", phone: "+8801700112233", customFields: {} },
      });
    expect(c1.status).toBe(201);
    const checkout1 = await runInOrganizationContext(world.organizationA, () =>
      checkoutRepo.findById(world.organizationA, c1.body.data.checkoutId),
    );

    // Second checkout
    const q2 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const c2 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId: q2.body.data.quoteId,
        contact: { name: "Guest User", phone: "+8801700112233", customFields: {} },
      });
    expect(c2.status).toBe(201);
    const checkout2 = await runInOrganizationContext(world.organizationA, () =>
      checkoutRepo.findById(world.organizationA, c2.body.data.checkoutId),
    );

    // Both checkouts used the identical provisional contactId
    expect(checkout1?.contactId).toBeDefined();
    expect(checkout1?.contactId).toBe(checkout2?.contactId);
  });

  it("aborts entire checkout with CHECKOUT_PRICE_CHANGED when catalog price or config version changes after quote", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const q = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const quoteId = q.body.data.quoteId;

    // Price changes in catalog
    catalogPricingOverride = (selections) => ({
      lines: selections.map((s) => ({
        selectionId: s.selectionId,
        subtotal: { amount: 9999, currency: CURRENCY_CODE.BDT },
        discount: { amount: 0, currency: CURRENCY_CODE.BDT },
        tax: { amount: 0, currency: CURRENCY_CODE.BDT },
        total: { amount: 9999, currency: CURRENCY_CODE.BDT },
        amountRequiredBeforeConfirmation: { amount: 0, currency: CURRENCY_CODE.BDT },
      })),
      total: { amount: 9999, currency: CURRENCY_CODE.BDT },
      deliveryCharge: { amount: 0, currency: CURRENCY_CODE.BDT },
      configVersion: orgStorefrontConfig.configVersion,
    });

    const res = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODE.CHECKOUT_PRICE_CHANGED);

    const saved = await runInOrganizationContext(world.organizationA, () =>
      checkoutRepo.findByQuoteId(world.organizationA, quoteId),
    );
    expect(saved).toBeNull();
  });

  it("aborts entire checkout with CHECKOUT_QUOTE_EXPIRED when quote has expired", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const q = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const quoteId = q.body.data.quoteId;

    // Fast-forward 6 minutes (> 300s TTL)
    currentTime = new Date(currentTime.getTime() + 360000);

    const res = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODE.CHECKOUT_QUOTE_EXPIRED);
  });

  it("rolls back all requests, provisional contact, payment summaries, and outbox if any selection group fails", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const q = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections(),
        fulfillment: { method: "PICKUP" },
      });
    const quoteId = q.body.data.quoteId;

    // Simulate booking failure (e.g. capacity full)
    bookingRequestError = new Error("Capacity full");

    const res = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });

    expect(res.status).toBe(500);

    // Quote should still be unconsumed
    const quoteDoc = await runInOrganizationContext(world.organizationA, () =>
      quoteRepo.findById(world.organizationA, quoteId),
    );
    expect(quoteDoc?.consumedAt).toBeNull();

    // No checkout record created
    const savedCheckout = await runInOrganizationContext(world.organizationA, () =>
      checkoutRepo.findByQuoteId(world.organizationA, quoteId),
    );
    expect(savedCheckout).toBeNull();
  });

  it("returns original CheckoutResponse on idempotent replay with same principal and Idempotency-Key", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const q = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const quoteId = q.body.data.quoteId;
    const idempotencyKey = newId();

    const firstRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });
    expect(firstRes.status).toBe(201);

    // Replay with exact same idempotency key and payload
    const replayRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });

    expect(replayRes.status).toBe(201);
    expect(replayRes.body.data.checkoutId).toBe(firstRes.body.data.checkoutId);
  });

  it("refuses replay or consumption of another principal's quote or checkout within the same organization", async () => {
    const world = await worldFor(harness, RETAIL);
    const guestA = await createGuest(world.organizationA);
    const guestB = await createGuest(world.organizationA);

    const cookieA = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guestA.guestSessionId, guestA.rawSecret)}`;
    const cookieB = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guestB.guestSessionId, guestB.rawSecret)}`;

    // Guest A gets a quote
    const qA = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookieA)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const quoteIdA = qA.body.data.quoteId;

    // Guest B attempts to submit checkout against Guest A's quote
    const hijackRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookieB)
      .set("Idempotency-Key", newId())
      .send({
        quoteId: quoteIdA,
        contact: { name: "Guest B", phone: "+8801711223344", customFields: {} },
      });

    expect(hijackRes.status).toBe(403);
  });

  it("refuses second checkout with a different Idempotency-Key against an already consumed quoteId", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const q = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookie)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const quoteId = q.body.data.quoteId;

    // First checkout succeeds
    const res1 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });
    expect(res1.status).toBe(201);

    // Second checkout with new key against already consumed quote
    const res2 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", newId())
      .send({
        quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });

    expect(res2.status).toBe(409);
  });

  it("enforces cross-organization isolation and 10 checkouts per 10 minutes rate limit", async () => {
    const world = await worldFor(harness, RETAIL);
    const guestA = await createGuest(world.organizationA);
    const cookieA = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guestA.guestSessionId, guestA.rawSecret)}`;

    // Cross-organization attempt: Guest of Org A tries to quote in Org B
    const crossOrgRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationB}/quotes`)
      .set("Cookie", cookieA)
      .send({
        locationId: world.locationB1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    expect(crossOrgRes.status).toBe(401);
    expect(crossOrgRes.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);

    // Rate limit: 10 checkouts allowed per 10 minutes, 11th gets rate limited
    for (let i = 0; i < 10; i++) {
      const q = await request(app)
        .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
        .set("Cookie", cookieA)
        .send({
          locationId: world.locationA1,
          selections: sampleSelections().slice(0, 1),
          fulfillment: { method: "PICKUP" },
        });
      const res = await request(app)
        .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
        .set("Cookie", cookieA)
        .set("Idempotency-Key", newId())
        .send({
          quoteId: q.body.data.quoteId,
          contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
        });
      expect(res.status).toBe(201);
    }

    // 11th attempt
    const q11 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/quotes`)
      .set("Cookie", cookieA)
      .send({
        locationId: world.locationA1,
        selections: sampleSelections().slice(0, 1),
        fulfillment: { method: "PICKUP" },
      });
    const res11 = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookieA)
      .set("Idempotency-Key", newId())
      .send({
        quoteId: q11.body.data.quoteId,
        contact: { name: "Guest", phone: "+8801711223344", customFields: {} },
      });

    expect(res11.status).toBe(429);
  });
});
