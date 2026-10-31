import { CURRENCY_CODE, ERROR_CODE } from "@banijjik/contracts";
import {
  SF_GUEST_COOKIE_NAME,
  formatGuestCookie,
  type CheckoutDetailResponse,
  type CheckoutSelection,
  type PublicQuoteLine,
  type StorefrontRequestListResponse,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithRequestContext } from "../../../kernel/context/index.js";
import { models, MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { errorHandler } from "../../../kernel/http/index.js";
import { MongoRateLimiter } from "../../../kernel/rate-limit/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import type {
  CatalogQuoteReaderPort,
  GuestContactPort,
  OrgStorefrontConfigReader,
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
  StorefrontOrganizationConfig,
} from "./application/checkout-ports.js";
import {
  ClaimCheckoutUseCase,
  type CustomerPhoneReaderPort,
} from "./application/claim-checkout.js";
import { QuoteCheckoutUseCase } from "./application/quote-checkout.js";
import {
  ReadOwnRequestsUseCase,
  statusKey,
  type RequestStatusReadInput,
  type RequestStatusReaderPort,
  type RequestStatusSnapshot,
} from "./application/read-own-requests.js";
import { SubmitCheckoutUseCase } from "./application/submit-checkout.js";
import { CreateGuestSessionUseCase } from "./application/use-cases/create-guest-session.use-case.js";
import { ResolveGuestSessionUseCase } from "./application/use-cases/resolve-guest-session.use-case.js";
import {
  MongoCheckoutAccessRepository,
  MongoCheckoutRepository,
  MongoCheckoutRequestLinkRepository,
} from "./infrastructure/mongo-checkout.repository.js";
import { MongoCheckoutQuoteRepository } from "./infrastructure/mongo-checkout-quote.repository.js";
import { CHECKOUT_REQUEST_LINK_MODEL_NAME } from "./infrastructure/checkout.schema.js";
import { MongoGuestSessionRepository } from "./infrastructure/mongo-guest-session.repository.js";
import { buildCheckoutRouter } from "./presentation/checkout.router.js";
import { buildStorefrontRequestStatusReaderAdapter } from "../../../routes/storefront-request-status-adapter.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

function requirePresent<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${label} to be present`);
  return value;
}

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("Storefront Private Request Projections, Tracking & Guest Claim (Card 4.3 Part A5A)", () => {
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
  const verifiedPhones = new Map<string, string>();
  const customerContacts = new Map<string, string>();
  const requestStatuses = new Map<string, RequestStatusSnapshot>();

  const orgConfigReader: OrgStorefrontConfigReader = {
    readStorefrontConfig: async () => orgStorefrontConfig,
  };

  const catalogQuoter: CatalogQuoteReaderPort = {
    priceSelections: async (input) => {
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
        configVersion: 1,
      };
    },
  };

  const guestContacts: GuestContactPort = {
    ensureProvisionalContact: async () => newId(),
  };

  const publicOrders: PublicOrderCommands = {
    place: async (_ctx, input) => ({
      selectionIds: input.selections.map((s) => s.selectionId),
      requestType: "ORDER",
      requestId: newId(),
      publicNumber: "ORD-001",
      status: "PLACED",
      paymentRequired: { amount: 5000, currency: CURRENCY_CODE.BDT },
      payableAmount: { amount: 5000, currency: CURRENCY_CODE.BDT },
      holdExpiresAt: null,
    }),
  };

  const publicBookings: PublicBookingCommands = {
    request: async (_ctx, input) => ({
      selectionIds: [input.selectionId],
      requestType: "BOOKING",
      requestId: newId(),
      publicNumber: "BKG-001",
      status: "HELD",
      paymentRequired: { amount: 1000, currency: CURRENCY_CODE.BDT },
      payableAmount: { amount: 1000, currency: CURRENCY_CODE.BDT },
      holdExpiresAt: new Date(currentTime.getTime() + 900000).toISOString(),
    }),
  };

  const publicEnrollments: PublicEnrollmentCommands = {
    request: async (_ctx, input) => ({
      selectionIds: [input.selectionId],
      requestType: "ENROLLMENT",
      requestId: newId(),
      publicNumber: "ENR-001",
      status: "PENDING",
      paymentRequired: { amount: 2500, currency: CURRENCY_CODE.BDT },
      payableAmount: { amount: 2500, currency: CURRENCY_CODE.BDT },
      holdExpiresAt: null,
    }),
  };

  const customerPhoneReader: CustomerPhoneReaderPort = {
    getVerifiedPhone: async (_orgId, customerAccountId) =>
      verifiedPhones.get(customerAccountId) ?? null,
  };

  let statusReaderOverride: RequestStatusReaderPort | null = null;
  let statusBatches: readonly RequestStatusReadInput[][] = [];

  const requestStatusReader: RequestStatusReaderPort = {
    readStatuses: async (inputs) => {
      if (statusReaderOverride) return statusReaderOverride.readStatuses(inputs);
      statusBatches = [...statusBatches, [...inputs]];
      return new Map(
        inputs.flatMap((input) => {
          const key = statusKey(input.requestType, input.requestId);
          const snapshot = requestStatuses.get(key);
          return snapshot ? [[key, snapshot] as const] : [];
        }),
      );
    },
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
    verifiedPhones.clear();
    customerContacts.clear();
    requestStatuses.clear();
    statusReaderOverride = null;
    statusBatches = [];

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

    const readOwnRequests = new ReadOwnRequestsUseCase({
      access: accessRepo,
      checkouts: checkoutRepo,
      requestLinks: requestLinkRepo,
      requestStatusReader,
      clock,
    });

    const resolveGuestSession = new ResolveGuestSessionUseCase(guestRepo, clock);

    const claimCheckout = new ClaimCheckoutUseCase({
      access: accessRepo,
      checkouts: checkoutRepo,
      requestLinks: requestLinkRepo,
      resolveGuestSession,
      customerPhoneReader,
      unitOfWork,
      events: kernelEventPublisher,
      clock,
    });

    const checkoutRouter = buildCheckoutRouter({
      requireWebsiteModule: (_req, _res, next) => next(),
      quoteCheckout,
      submitCheckout,
      readOwnRequests,
      claimCheckout,
      resolveGuestSession,
      resolveCustomerContactId: async (_orgId, accountId) => customerContacts.get(accountId),
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
        const customerAccountId = req.headers["x-test-customer-account-id"] as string | undefined;
        void runInOrganizationContext(organizationId, async () => {
          runWithRequestContext(
            {
              organizationId,
              requestId: newId(),
              ...(customerAccountId !== undefined ? { customerAccountId } : {}),
            },
            () => next(),
          );
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
          quantity: 1,
          modifierOptionIds: [],
        },
        customFields: {},
      },
    ];
  }

  async function createQuoteAndCheckout(input: {
    readonly organizationId: string;
    readonly locationId: string;
    readonly cookie?: string;
    readonly customerAccountId?: string;
    readonly contactPhone?: string;
    readonly selections?: CheckoutSelection[];
  }) {
    let quoteReq = request(app)
      .post(`/api/v1/storefront/orgs/${input.organizationId}/quotes`)
      .send({
        locationId: input.locationId,
        selections: input.selections ?? sampleSelections(),
        fulfillment: { method: "PICKUP" },
      });
    if (input.cookie) quoteReq = quoteReq.set("Cookie", input.cookie);
    if (input.customerAccountId)
      quoteReq = quoteReq.set("x-test-customer-account-id", input.customerAccountId);

    const quoteRes = await quoteReq;
    expect(quoteRes.status).toBe(201);
    const quoteId = quoteRes.body.data.quoteId as string;

    const idempotencyKey = newId();
    let checkoutReq = request(app)
      .post(`/api/v1/storefront/orgs/${input.organizationId}/checkout`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        quoteId,
        contact: {
          name: "Test Customer",
          phone: input.contactPhone ?? "+8801700000001",
        },
      });
    if (input.cookie) checkoutReq = checkoutReq.set("Cookie", input.cookie);
    if (input.customerAccountId)
      checkoutReq = checkoutReq.set("x-test-customer-account-id", input.customerAccountId);

    const checkoutRes = await checkoutReq;
    expect(checkoutRes.status).toBe(201);
    const checkoutId = checkoutRes.body.data.checkoutId as string;
    return { quoteId, checkoutId, idempotencyKey, response: checkoutRes.body.data };
  }

  it("reads checkout detail and /me/requests list for owning guest session or customer account with no-store headers", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
    });

    // 1. Read checkout detail as guest
    const detailRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("Cookie", cookie);

    expect(detailRes.status).toBe(200);
    expect(detailRes.headers["cache-control"]).toContain("no-store");
    const detailData = detailRes.body.data as CheckoutDetailResponse;
    expect(detailData.checkoutId).toBe(checkoutId);
    expect(detailData.ownerType).toBe("GUEST");
    expect(detailData.canClaim).toBe(true);
    expect(detailData.requests).toHaveLength(1);

    // 2. Read /me/requests as guest
    const listRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("Cookie", cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.headers["cache-control"]).toContain("no-store");
    const listData = listRes.body.data as StorefrontRequestListResponse;
    expect(listData.items).toHaveLength(1);
    expect(listData.items[0]?.checkoutId).toBe(checkoutId);

    // 3. Read as customer account
    const customerAccountId = newId();
    customerContacts.set(customerAccountId, newId());
    const custCheckout = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      customerAccountId,
    });

    const custDetailRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${custCheckout.checkoutId}`)
      .set("x-test-customer-account-id", customerAccountId);

    expect(custDetailRes.status).toBe(200);
    expect(custDetailRes.headers["cache-control"]).toContain("no-store");
    expect(custDetailRes.body.data.ownerType).toBe("CUSTOMER");
    expect(custDetailRes.body.data.canClaim).toBe(false);

    const custListRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("x-test-customer-account-id", customerAccountId);

    expect(custListRes.status).toBe(200);
    expect(custListRes.headers["cache-control"]).toContain("no-store");
    expect(custListRes.body.data.items).toHaveLength(1);
    expect(custListRes.body.data.items[0].checkoutId).toBe(custCheckout.checkoutId);
  });

  it("revokes request links with the access row so a revoked session loses list and detail", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
    });

    const revoked = await runInOrganizationContext(world.organizationA, () =>
      accessRepo.revoke(world.organizationA, checkoutId, currentTime),
    );
    expect(revoked).toBe(true);

    const links = await runInOrganizationContext(world.organizationA, () =>
      requestLinkRepo.listByCheckoutId(world.organizationA, checkoutId),
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.revokedAt).toEqual(currentTime);

    const detailRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("Cookie", cookie);
    expect(detailRes.status).toBe(404);
    expect(detailRes.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    const listRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("Cookie", cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(0);
    expect(listRes.body.data.total).toBe(0);
  });

  it("pages owner requests in the database, filters by type there, and batches status reads", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const firstCheckout = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
    });
    const secondCheckout = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
    });

    const linkModel = await runInOrganizationContext(world.organizationA, async () =>
      models({}).get<Record<string, unknown>>(CHECKOUT_REQUEST_LINK_MODEL_NAME),
    );
    const findSpy = vi.spyOn(linkModel, "find");
    const countSpy = vi.spyOn(linkModel, "countDocuments");

    try {
      const firstPage = await request(app)
        .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests?page=1&limit=1`)
        .set("Cookie", cookie);
      const secondPage = await request(app)
        .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests?page=2&limit=1`)
        .set("Cookie", cookie);
      const filteredPage = await request(app)
        .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests?requestType=BOOKING`)
        .set("Cookie", cookie);
      const allPage = await request(app)
        .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
        .set("Cookie", cookie);

      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      expect(firstPage.body.data.total).toBe(2);
      expect(secondPage.body.data.total).toBe(2);
      expect(firstPage.body.data.items).toHaveLength(1);
      expect(secondPage.body.data.items).toHaveLength(1);
      expect(firstPage.body.data.items[0].checkoutId).not.toBe(
        secondPage.body.data.items[0].checkoutId,
      );
      expect([firstCheckout.checkoutId, secondCheckout.checkoutId]).toContain(
        firstPage.body.data.items[0].checkoutId,
      );
      expect(filteredPage.body.data.items).toHaveLength(0);
      expect(filteredPage.body.data.total).toBe(0);

      // 4 list calls, one query each: never one query per link.
      expect(findSpy).toHaveBeenCalledTimes(4);
      expect(countSpy).toHaveBeenCalledTimes(4);
      const filters = findSpy.mock.calls.map((call) => call[0]);
      expect(filters[0]).toMatchObject({
        revokedAt: null,
        ownerType: "GUEST",
        ownerIdentifier: guest.guestSessionId,
      });
      expect(filters[2]).toMatchObject({ requestType: "BOOKING" });
      expect(filters[3]).not.toHaveProperty("requestType");
      expect(findSpy.mock.results[0]?.value.getOptions()).toMatchObject({ skip: 0, limit: 1 });
      expect(findSpy.mock.results[1]?.value.getOptions()).toMatchObject({ skip: 1, limit: 1 });
      expect(allPage.status).toBe(200);
      expect(allPage.body.data.items).toHaveLength(2);
    } finally {
      findSpy.mockRestore();
      countSpy.mockRestore();
    }

    // Two paginated pages (1 link each) and one unfiltered page (2 links): one batched read each.
    expect(statusBatches.map((batch) => batch.length)).toEqual([1, 1, 2]);
  });

  it("projects enrollment payable amount using enrollmentPeriodId as payment requestId", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;

    const { checkoutId, response } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
      selections: [
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
      ],
    });

    const enrollmentRequestId = response.requests[0].requestId as string;
    const enrollmentPeriodId = newId();
    const summaryQueries: string[][] = [];
    statusReaderOverride = buildStorefrontRequestStatusReaderAdapter({
      orders: { findByIds: async () => [] },
      bookings: { findByIds: async () => [] },
      enrollments: {
        findByIds: async (ids) =>
          ids.map((enrollmentId) => ({
            enrollmentId,
            organizationId: world.organizationA,
            enrollmentNumber: "ENR-000042",
            status: "ACTIVE",
            currentEnrollmentPeriodId: enrollmentPeriodId,
            startsOn: "2026-11-01",
            firstRecurringFee: { amount: 5000, currency: CURRENCY_CODE.BDT },
            createdAt: currentTime,
          })),
      },
      summaries: {
        findByRequests: async (_organizationId, _requestType, requestIds) => {
          summaryQueries.push([...requestIds]);
          // ADR-139: the payable belongs to the current period, never the enrollment ID.
          return requestIds.includes(enrollmentPeriodId)
            ? [
                {
                  requestId: enrollmentPeriodId,
                  due: { amount: 7500, currency: CURRENCY_CODE.BDT },
                },
              ]
            : [];
        },
      },
    });

    const detailRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("Cookie", cookie);

    expect(detailRes.status).toBe(200);
    const detailData = detailRes.body.data as CheckoutDetailResponse;
    expect(detailData.requests[0]?.publicNumber).toBe("ENR-000042");
    expect(detailData.requests[0]?.paymentRequired.amount).toBe(7500);

    const singleReqRes = await request(app)
      .get(
        `/api/v1/storefront/orgs/${world.organizationA}/me/requests/ENROLLMENT/${enrollmentRequestId}`,
      )
      .set("Cookie", cookie);

    expect(singleReqRes.status).toBe(200);
    expect(singleReqRes.body.data.paymentRequired.amount).toBe(7500);
    expect(singleReqRes.body.data.publicNumber).toBe("ENR-000042");
    expect(singleReqRes.body.data.plan).toEqual({ startsOn: "2026-11-01", endsOn: null });
    expect(summaryQueries).toEqual([[enrollmentPeriodId], [enrollmentPeriodId]]);
  });

  it("refuses checkout detail and /me/requests access to another customer or guest session in the same organization", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest1 = await createGuest(world.organizationA);
    const cookie1 = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest1.guestSessionId, guest1.rawSecret)}`;

    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie: cookie1,
    });

    // Foreign guest session in the same organization
    const guest2 = await createGuest(world.organizationA);
    const cookie2 = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest2.guestSessionId, guest2.rawSecret)}`;

    // A foreign owner is indistinguishable from a missing checkout: 404, not a 403 oracle.
    const foreignGuestRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("Cookie", cookie2);
    expect(foreignGuestRes.status).toBe(404);
    expect(foreignGuestRes.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    const foreignGuestList = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("Cookie", cookie2);
    expect(foreignGuestList.status).toBe(200);
    expect(foreignGuestList.body.data.items).toHaveLength(0);

    // Foreign customer account in the same organization
    const foreignCustomerId = newId();
    customerContacts.set(foreignCustomerId, newId());

    const foreignCustRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("x-test-customer-account-id", foreignCustomerId);
    expect(foreignCustRes.status).toBe(404);
    expect(foreignCustRes.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    const foreignCustList = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("x-test-customer-account-id", foreignCustomerId);
    expect(foreignCustList.status).toBe(200);
    expect(foreignCustList.body.data.items).toHaveLength(0);
  });

  it("denies an organization B guest access to an organization A checkout, list and claim", async () => {
    const world = await worldFor(harness, RETAIL);
    const guestA = await createGuest(world.organizationA);
    const cookieA = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guestA.guestSessionId, guestA.rawSecret)}`;
    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie: cookieA,
    });
    const guestB = await createGuest(world.organizationB);
    const cookieB = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guestB.guestSessionId, guestB.rawSecret)}`;

    const response = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationB}/checkouts/${checkoutId}`)
      .set("Cookie", cookieB);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    const listResponse = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationB}/me/requests`)
      .set("Cookie", cookieB);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(0);
    expect(listResponse.body.data.total).toBe(0);

    const claimResponse = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationB}/checkouts/${checkoutId}/claim`)
      .set("Cookie", cookieB)
      .set("x-test-customer-account-id", newId());
    expect(claimResponse.status).toBe(404);
    expect(claimResponse.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    // Organization A ownership is untouched by the cross-organization attempt.
    const accessA = await runInOrganizationContext(world.organizationA, () =>
      accessRepo.findByCheckoutId(world.organizationA, checkoutId),
    );
    expect(accessA?.owner).toEqual({
      type: "GUEST",
      identifier: guestA.guestSessionId,
    });
  });

  it("claims guest checkout into verified customer account when both guest cookie and matching verified phone are present", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const phone = "+8801712345678";

    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
      contactPhone: phone,
    });

    const customerAccountId = newId();
    verifiedPhones.set(customerAccountId, phone);
    customerContacts.set(customerAccountId, newId());

    const claimRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}/claim`)
      .set("Cookie", cookie)
      .set("x-test-customer-account-id", customerAccountId);

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.data.success).toBe(true);
    expect(claimRes.body.data.checkoutId).toBe(checkoutId);
    expect(claimRes.body.data.customerAccountId).toBe(customerAccountId);

    // Verify access record is now owned by the customer
    const updatedAccess = await runInOrganizationContext(world.organizationA, () =>
      accessRepo.findByCheckoutId(world.organizationA, checkoutId),
    );
    expect(updatedAccess?.owner.type).toBe("CUSTOMER");
    expect(updatedAccess?.owner.identifier).toBe(customerAccountId);

    // Verify customer can now track it
    const custDetail = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("x-test-customer-account-id", customerAccountId);
    expect(custDetail.status).toBe(200);
    expect(custDetail.body.data.ownerType).toBe("CUSTOMER");
    expect(custDetail.body.data.canClaim).toBe(false);
  });

  it("revokes guest session tracking and idempotency replay access immediately after checkout is claimed", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const phone = "+8801712345678";

    const { checkoutId, quoteId, idempotencyKey } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
      contactPhone: phone,
    });

    const customerAccountId = newId();
    verifiedPhones.set(customerAccountId, phone);
    customerContacts.set(customerAccountId, newId());

    // Claim checkout into customer
    const claimRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}/claim`)
      .set("Cookie", cookie)
      .set("x-test-customer-account-id", customerAccountId);
    expect(claimRes.status).toBe(200);

    // Guest session tracking is revoked immediately (different owner is a 404, not an oracle)
    const trackingRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}`)
      .set("Cookie", cookie);
    expect(trackingRes.status).toBe(404);
    expect(trackingRes.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    const movedLinks = await runInOrganizationContext(world.organizationA, () =>
      requestLinkRepo.listByCheckoutId(world.organizationA, checkoutId),
    );
    expect(movedLinks).toHaveLength(1);
    expect(movedLinks[0]?.ownerType).toBe("CUSTOMER");
    expect(movedLinks[0]?.ownerIdentifier).toBe(customerAccountId);

    const guestListRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("Cookie", cookie);
    expect(guestListRes.status).toBe(200);
    expect(guestListRes.body.data.items).toHaveLength(0);

    // The claimed request now belongs to the customer account
    const customerListRes = await request(app)
      .get(`/api/v1/storefront/orgs/${world.organizationA}/me/requests`)
      .set("x-test-customer-account-id", customerAccountId);
    expect(customerListRes.status).toBe(200);
    expect(customerListRes.body.data.items).toHaveLength(1);
    expect(customerListRes.body.data.items[0].checkoutId).toBe(checkoutId);

    // Idempotency replay by guest session is also revoked
    const replayRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkout`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        quoteId,
        contact: { name: "Test Customer", phone },
      });
    expect(replayRes.status).toBe(403);
  });

  it("refuses claim when authenticated customer phone does not match checkout contact snapshot", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const checkoutPhone = "+8801711111111";

    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
      contactPhone: checkoutPhone,
    });

    const customerAccountId = newId();
    // Different verified phone on customer account
    verifiedPhones.set(customerAccountId, "+8801799999999");
    customerContacts.set(customerAccountId, newId());

    const claimRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}/claim`)
      .set("Cookie", cookie)
      .set("x-test-customer-account-id", customerAccountId);

    expect(claimRes.status).toBe(403);
    expect(claimRes.body.error.code).toBe(ERROR_CODE.CHECKOUT_CLAIM_PHONE_MISMATCH);
  });

  it("refuses claim without original guest session cookie (no phone-only recovery)", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const phone = "+8801712345678";

    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
      contactPhone: phone,
    });

    const customerAccountId = newId();
    verifiedPhones.set(customerAccountId, phone);
    customerContacts.set(customerAccountId, newId());

    // Attempt claim without sf_guest cookie
    const noCookieClaim = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}/claim`)
      .set("x-test-customer-account-id", customerAccountId);
    expect(noCookieClaim.status).toBe(401);

    // Attempt claim with another guest's cookie
    const foreignGuest = await createGuest(world.organizationA);
    const foreignCookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(foreignGuest.guestSessionId, foreignGuest.rawSecret)}`;

    const foreignCookieClaim = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}/claim`)
      .set("Cookie", foreignCookie)
      .set("x-test-customer-account-id", customerAccountId);
    expect(foreignCookieClaim.status).toBe(403);
  });

  it("preserves immutable creationPrincipalKey and does not merge contacts or rewrite historical orders on claim", async () => {
    const world = await worldFor(harness, RETAIL);
    const guest = await createGuest(world.organizationA);
    const cookie = `${SF_GUEST_COOKIE_NAME}=${formatGuestCookie(guest.guestSessionId, guest.rawSecret)}`;
    const phone = "+8801712345678";

    const { checkoutId } = await createQuoteAndCheckout({
      organizationId: world.organizationA,
      locationId: world.locationA1,
      cookie,
      contactPhone: phone,
    });

    const beforeCheckout = requirePresent(
      await runInOrganizationContext(world.organizationA, () =>
        checkoutRepo.findById(world.organizationA, checkoutId),
      ),
      "beforeCheckout",
    );
    const originalCreationPrincipal = beforeCheckout.creationPrincipalKey;
    const originalContactId = beforeCheckout.contactId;
    expect(originalCreationPrincipal).toBe(`GUEST:${guest.guestSessionId}`);

    const beforeLinks = await runInOrganizationContext(world.organizationA, () =>
      requestLinkRepo.listByCheckoutId(world.organizationA, checkoutId),
    );
    expect(beforeLinks).toHaveLength(1);
    const beforeLink = requirePresent(beforeLinks[0], "a request link before the claim");
    expect(beforeLink.ownerType).toBe("GUEST");

    const customerAccountId = newId();
    verifiedPhones.set(customerAccountId, phone);
    const customerContactId = newId();
    customerContacts.set(customerAccountId, customerContactId);

    const claimRes = await request(app)
      .post(`/api/v1/storefront/orgs/${world.organizationA}/checkouts/${checkoutId}/claim`)
      .set("Cookie", cookie)
      .set("x-test-customer-account-id", customerAccountId);
    expect(claimRes.status).toBe(200);

    const afterCheckout = requirePresent(
      await runInOrganizationContext(world.organizationA, () =>
        checkoutRepo.findById(world.organizationA, checkoutId),
      ),
      "afterCheckout",
    );
    // creationPrincipalKey remains unchanged
    expect(afterCheckout.creationPrincipalKey).toBe(originalCreationPrincipal);
    // contactId on checkout remains original provisional contact, NOT merged with customerContactId
    expect(afterCheckout.contactId).toBe(originalContactId);
    expect(afterCheckout.contactId).not.toBe(customerContactId);

    // The historical request itself is moved, never rewritten: same request, same public number.
    const afterLinks = await runInOrganizationContext(world.organizationA, () =>
      requestLinkRepo.listByCheckoutId(world.organizationA, checkoutId),
    );
    expect(afterLinks).toHaveLength(1);
    const afterLink = requirePresent(afterLinks[0], "a request link after the claim");
    expect(afterLink.requestId).toBe(beforeLink.requestId);
    expect(afterLink.requestType).toBe(beforeLink.requestType);
    expect(afterLink.publicNumber).toBe(beforeLink.publicNumber);
    expect(afterLink.status).toBe(beforeLink.status);
    expect(afterLink.ownerType).toBe("CUSTOMER");
    expect(afterLink.ownerIdentifier).toBe(customerAccountId);
    expect(afterLink.revokedAt).toBeNull();
  });
});
