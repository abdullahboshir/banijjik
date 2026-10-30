import {
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_REQUIRE_APPROVAL_SETTING_KEY,
  BOOKING_STATUS,
  DEPOSIT_REQUIRED,
} from "@banijjik/contracts/booking";
import { PAYMENT_METHOD, PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import type { CheckoutSelection, StorefrontCommandContext } from "@banijjik/contracts/website";
import { asId, newId, type LocationId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { buildBookingTenantPorts } from "../../../routes/booking-tenant-router.js";
import { buildBookingRequestReader } from "../../../routes/booking-request-reader.js";
import {
  buildPaymentRequestLifecycles,
  buildPaymentRequestReaders,
} from "../../../routes/payment-request-readers.js";
import { MODULE_MANIFESTS } from "../../../routes/module-registry.js";
import { buildModuleRegistry } from "../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../routes/organization-config-ports.js";
import {
  createStylistResource,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "../../../test-support/booking-api-world.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { addCustomer, setSetting, shopOf } from "../../../test-support/sales-api-world.js";
import {
  Booking,
  buildBookingOfferingReader,
  buildBookingSettingsReader,
  buildOrganizationTimezoneReader,
  buildStorefrontBookingCommands,
  MongoBookingRepository,
  MongoEventSessionRepository,
  MongoResourceRepository,
  MongoResourceSlotUsageRepository,
} from "../booking/index.js";
import { buildIndustryTemplateReader } from "../../platform/industry/index.js";
import { buildOrgConfigService } from "../../platform/entitlement/index.js";
import {
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  ReceivePaymentUseCase,
  type RequestPaymentLifecycle,
} from "./index.js";

registerIamApiModels();

const SALON = { industryTemplateKey: "SALON" };
const RETAIL = { industryTemplateKey: "RETAIL" };
const SUNDAY_DATE = "2026-11-01T10:00:00.000Z";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("Payment Receipt Lifecycle Integration (Part A3P)", () => {
  async function setupShop(suffix: string) {
    const world = await worldFor(harness, RETAIL, SALON);
    const shop = shopOf(world);
    const service = await publishBookableService(shop.actor, shop.organizationId);
    await createStylistResource(shop.actor, shop.organizationId, {
      locationId: shop.locationId,
      offeringId: service.offeringId,
      name: `Stylist-${suffix}`,
      capacity: 5,
      weeklySchedule: SUNDAY_SCHEDULE,
    });
    const contactId = await addCustomer(shop, `Guest Booking-${suffix}`, "+8801700000000");

    const registry = buildModuleRegistry();
    const orgConfig = buildOrgConfigService({
      registry,
      clock: harness.clock,
      ...buildOrganizationConfigPorts(),
      ...buildResolvedConfigSources(registry),
      templates: buildIndustryTemplateReader(harness.clock),
    });

    const audit = buildAuditRecorder(harness.clock);

    const ports = buildBookingTenantPorts({
      clock: harness.clock,
      audit,
      orgConfig,
      manifests: MODULE_MANIFESTS,
      permission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      idempotency: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      permissions: {
        locationsWith: async () => "ALL",
      },
    });

    const bookings = new MongoBookingRepository();
    const resources = new MongoResourceRepository();
    const slots = new MongoResourceSlotUsageRepository();
    const sessions = new MongoEventSessionRepository();
    const unitOfWork = new MongoUnitOfWork();
    const events = kernelEventPublisher;
    const offerings = buildBookingOfferingReader();
    const settings = buildBookingSettingsReader({ orgConfig, manifests: MODULE_MANIFESTS });
    const timeZone = buildOrganizationTimezoneReader();
    const timeOff = { listOverlapping: async () => [] };
    const kinds = {
      effectiveKinds: async (organizationId: OrganizationId) =>
        (await orgConfig.forOrganization(organizationId)).config.kinds,
    };

    const bookingDeps = {
      bookings,
      resources,
      slots,
      sessions,
      unitOfWork,
      events,
      audit,
      clock: harness.clock,
      offerings,
      settings,
      quoter: ports.quoter,
      contacts: ports.contacts,
      timeZone,
      timeOff,
      kinds,
      depositCheck: ports.depositCheck,
    };

    const rawCommands = buildStorefrontBookingCommands(bookingDeps);
    const commands = {
      request: (context: StorefrontCommandContext, input: CheckoutSelection) =>
        runInOrganizationContext(context.organizationId, () => rawCommands.request(context, input)),
    };

    const payments = new MongoPaymentRepository();
    const storeCredit = new MongoStoreCreditRepository();
    const summaries = new MongoPaymentSummaryRepository();
    const contactStoreCredit = new MongoContactStoreCreditAdapter();
    const requestReaders = buildPaymentRequestReaders();
    const lifecycles = buildPaymentRequestLifecycles({
      orgConfig,
      manifests: MODULE_MANIFESTS,
      clock: harness.clock,
      audit,
    });

    const paymentDeps = {
      payments,
      storeCredit,
      summaries,
      contactStoreCredit,
      requestReaders,
      lifecycles,
      unitOfWork,
      events,
      audit,
      clock: harness.clock,
      timeZone,
      orgConfig,
    };

    const receivePaymentUseCase = new ReceivePaymentUseCase(paymentDeps);
    const memberId = newId();
    const organizationId = asId<OrganizationId>(shop.organizationId);
    const locationId = asId<LocationId>(shop.locationId);
    const userId = asId<UserId>(world.alice.userId);

    return {
      world,
      shop: {
        ...shop,
        organizationId,
        locationId,
        memberId,
        userId,
      },
      service,
      contactId,
      commands,
      bookings,
      summaries,
      payments,
      paymentDeps,
      receivePaymentUseCase,
      timeZone,
      orgConfig,
      unitOfWork,
    };
  }

  function sampleSelection(service: {
    offeringId: string;
    variants: { variantId: string }[];
  }): CheckoutSelection {
    const firstVariant = service.variants[0];
    if (!firstVariant) {
      throw new Error("Service must have at least one variant");
    }
    return {
      selectionId: "sel-booking-1",
      selection: {
        kind: "SERVICE",
        offeringId: service.offeringId,
        variantId: firstVariant.variantId,
        startsAt: SUNDAY_DATE,
        resourceIds: [],
      },
      customFields: {},
    };
  }

  it("ReceivePayment invokes beginReceipt before reading summary and endReceipt after allocation", async () => {
    const { shop, service, contactId, commands, summaries, paymentDeps } =
      await setupShop("hook-order");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));

    const events: string[] = [];
    const spyLifecycle: RequestPaymentLifecycle = {
      async beginReceipt(input) {
        events.push(`begin:${input.requestId}`);
      },
      async endReceipt(input) {
        events.push(`end:${input.requestId}`);
      },
    };

    const customLifecycles = buildPaymentRequestLifecycles({
      bookingLifecycle: spyLifecycle,
    });

    const originalFindByRequest = summaries.findByRequest.bind(summaries);
    summaries.findByRequest = async (organizationId, reqType, reqId) => {
      events.push(`readSummary:${reqId}`);
      return originalFindByRequest(organizationId, reqType, reqId);
    };

    const receivePaymentUseCase = new ReceivePaymentUseCase({
      ...paymentDeps,
      lifecycles: customLifecycles,
    });

    await runInOrganizationContext(shop.organizationId, () =>
      receivePaymentUseCase.execute({
        organizationId: shop.organizationId,
        locationId: asId(shop.locationId),
        method: PAYMENT_METHOD.CASH,
        amount: { amount: 10000, currency: "BDT" },
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: link.requestId,
            amount: { amount: 10000, currency: "BDT" },
          },
        ],
        contactId,
        receivedByMemberId: shop.memberId,
        actorUserId: shop.userId,
      }),
    );

    expect(events).toEqual([
      `begin:${link.requestId}`,
      `readSummary:${link.requestId}`,
      `end:${link.requestId}`,
    ]);
  });

  it("ReceivePayment commits booking deposit and hold transition atomically in single transaction", async () => {
    const { shop, service, contactId, commands, bookings, receivePaymentUseCase } =
      await setupShop("commit-atomic");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);
    await setSetting(shop, BOOKING_REQUIRE_APPROVAL_SETTING_KEY, true);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));
    expect(link.status).toBe(BOOKING_STATUS.HELD);

    const paymentResponse = await runInOrganizationContext(shop.organizationId, () =>
      receivePaymentUseCase.execute({
        organizationId: shop.organizationId,
        locationId: asId(shop.locationId),
        method: PAYMENT_METHOD.CASH,
        amount: { amount: 10000, currency: "BDT" },
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: link.requestId,
            amount: { amount: 10000, currency: "BDT" },
          },
        ],
        contactId,
        receivedByMemberId: shop.memberId,
        actorUserId: shop.userId,
      }),
    );

    expect(paymentResponse.amount.amount).toBe(10000);

    const updatedBooking = await runInOrganizationContext(shop.organizationId, () =>
      bookings.findById(asId(link.requestId)),
    );
    expect([BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED]).toContain(updatedBooking?.status);
    expect(updatedBooking?.paymentFenceVersion).toBe(1);
    expect(updatedBooking?.bookingNumber).toBeDefined();
  });

  it("ReceivePayment rejects payment on booking whose hold is expired or fence rejected", async () => {
    const { shop, service, contactId, commands, bookings, receivePaymentUseCase } =
      await setupShop("reject-expired");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));

    // Expire the hold in the past
    const booking = await runInOrganizationContext(shop.organizationId, () =>
      bookings.findById(asId(link.requestId)),
    );
    expect(booking).toBeDefined();
    if (booking) {
      const expiredBooking = Booking.rehydrate({
        ...booking.toProps(),
        holdExpiresAt: new Date(Date.now() - 3600000),
      });
      await runInOrganizationContext(shop.organizationId, () =>
        bookings.update(expiredBooking, booking.version),
      );
    }

    // Attempt to receive payment after hold is expired
    await expect(
      runInOrganizationContext(shop.organizationId, () =>
        receivePaymentUseCase.execute({
          organizationId: shop.organizationId,
          locationId: asId(shop.locationId),
          method: PAYMENT_METHOD.CASH,
          amount: { amount: 10000, currency: "BDT" },
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: link.requestId,
              amount: { amount: 10000, currency: "BDT" },
            },
          ],
          contactId,
          receivedByMemberId: shop.memberId,
          actorUserId: shop.userId,
        }),
      ),
    ).rejects.toThrow();
  });

  it("ReceivePayment safely processes ORDER and ENROLLMENT via default pass-through lifecycles", async () => {
    const { shop, contactId, paymentDeps } = await setupShop("default-lifecycles");

    const orderId = newId();
    const enrollmentId = newId();

    paymentDeps.requestReaders.register(PAYMENT_REQUEST_TYPE.ORDER, {
      async read(_orgId, requestId) {
        if (requestId !== orderId) return undefined;
        return {
          requestId: orderId,
          requestType: PAYMENT_REQUEST_TYPE.ORDER,
          total: { amount: 5000, currency: "BDT" },
          revenueState: "BEFORE_REVENUE",
          contactId,
          locationId: shop.locationId,
          acceptsPayments: true,
          refundLimit: null,
        };
      },
    });

    paymentDeps.requestReaders.register(PAYMENT_REQUEST_TYPE.ENROLLMENT, {
      async read(_orgId, requestId) {
        if (requestId !== enrollmentId) return undefined;
        return {
          requestId: enrollmentId,
          requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
          total: { amount: 7000, currency: "BDT" },
          revenueState: "BEFORE_REVENUE",
          contactId,
          locationId: shop.locationId,
          acceptsPayments: true,
          refundLimit: null,
        };
      },
    });

    await runInOrganizationContext(shop.organizationId, async () => {
      await paymentDeps.summaries.ensureSummary({
        organizationId: shop.organizationId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        requestId: orderId,
        contactId,
        locationId: asId(shop.locationId),
        total: { amount: 5000, currency: "BDT" },
        now: new Date(),
      });

      await paymentDeps.summaries.ensureSummary({
        organizationId: shop.organizationId,
        requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
        requestId: enrollmentId,
        contactId,
        locationId: asId(shop.locationId),
        total: { amount: 7000, currency: "BDT" },
        now: new Date(),
      });
    });

    const useCase = new ReceivePaymentUseCase(paymentDeps);

    const orderPayment = await runInOrganizationContext(shop.organizationId, () =>
      useCase.execute({
        organizationId: shop.organizationId,
        locationId: asId(shop.locationId),
        method: PAYMENT_METHOD.CASH,
        amount: { amount: 5000, currency: "BDT" },
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.ORDER,
            requestId: orderId,
            amount: { amount: 5000, currency: "BDT" },
          },
        ],
        contactId,
        receivedByMemberId: shop.memberId,
        actorUserId: shop.userId,
      }),
    );
    expect(orderPayment.amount.amount).toBe(5000);

    const enrollmentPayment = await runInOrganizationContext(shop.organizationId, () =>
      useCase.execute({
        organizationId: shop.organizationId,
        locationId: asId(shop.locationId),
        method: PAYMENT_METHOD.CASH,
        amount: { amount: 7000, currency: "BDT" },
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
            requestId: enrollmentId,
            amount: { amount: 7000, currency: "BDT" },
          },
        ],
        contactId,
        receivedByMemberId: shop.memberId,
        actorUserId: shop.userId,
      }),
    );
    expect(enrollmentPayment.amount.amount).toBe(7000);
  });

  it("booking request reader reports acceptsPayments false for terminal booking or expired hold", async () => {
    const fixedNow = new Date("2026-11-01T12:00:00.000Z");
    const organizationId = asId<OrganizationId>(newId());

    const terminalStatuses = [
      BOOKING_STATUS.CANCELLED,
      BOOKING_STATUS.EXPIRED,
      BOOKING_STATUS.NO_SHOW,
    ] as const;

    for (const status of terminalStatuses) {
      const bookingId = newId();
      const mockReader = {
        async findById() {
          return {
            bookingId,
            organizationId,
            locationId: "loc-1",
            contactId: "c-1",
            status,
            holdExpiresAt: null,
            price: { total: { amount: 1000, currency: "BDT" as const } },
          } as never;
        },
      };
      const reader = buildBookingRequestReader(mockReader, () => fixedNow);
      const snapshot = await reader.read(organizationId, bookingId);
      expect(snapshot?.acceptsPayments).toBe(false);
    }

    const expiredBookingId = newId();
    const expiredHoldReader = {
      async findById() {
        return {
          bookingId: expiredBookingId,
          organizationId,
          locationId: "loc-1",
          contactId: "c-1",
          status: BOOKING_STATUS.HELD,
          holdExpiresAt: new Date(fixedNow.getTime() - 60000),
          price: { total: { amount: 1000, currency: "BDT" as const } },
        } as never;
      },
    };
    const reader = buildBookingRequestReader(expiredHoldReader, () => fixedNow);
    const snapshot = await reader.read(organizationId, expiredBookingId);
    expect(snapshot?.acceptsPayments).toBe(false);
  });

  it("booking request reader reports acceptsPayments true for active hold or confirmed booking", async () => {
    const fixedNow = new Date("2026-11-01T12:00:00.000Z");
    const organizationId = asId<OrganizationId>(newId());

    const activeBookingId = newId();
    const activeHoldReader = {
      async findById() {
        return {
          bookingId: activeBookingId,
          organizationId,
          locationId: "loc-1",
          contactId: "c-1",
          status: BOOKING_STATUS.HELD,
          holdExpiresAt: new Date(fixedNow.getTime() + 600000),
          price: { total: { amount: 2000, currency: "BDT" as const } },
        } as never;
      },
    };
    const activeReader = buildBookingRequestReader(activeHoldReader, () => fixedNow);
    const activeSnapshot = await activeReader.read(organizationId, activeBookingId);
    expect(activeSnapshot?.acceptsPayments).toBe(true);

    const confirmedBookingId = newId();
    const confirmedReader = {
      async findById() {
        return {
          bookingId: confirmedBookingId,
          organizationId,
          locationId: "loc-1",
          contactId: "c-1",
          status: BOOKING_STATUS.CONFIRMED,
          holdExpiresAt: null,
          price: { total: { amount: 3000, currency: "BDT" as const } },
        } as never;
      },
    };
    const confirmedReqReader = buildBookingRequestReader(confirmedReader, () => fixedNow);
    const confirmedSnapshot = await confirmedReqReader.read(organizationId, confirmedBookingId);
    expect(confirmedSnapshot?.acceptsPayments).toBe(true);
  });

  it("payment failure or rollback aborts booking state transition and releases payment fence", async () => {
    const { shop, service, contactId, commands, bookings, paymentDeps } =
      await setupShop("rollback-abort");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));
    const bookingBefore = await runInOrganizationContext(shop.organizationId, () =>
      bookings.findById(asId(link.requestId)),
    );
    expect(bookingBefore?.status).toBe(BOOKING_STATUS.HELD);
    expect(bookingBefore?.paymentFenceVersion).toBe(0);

    // Provide a payments repo that fails during payment creation to trigger transaction rollback
    const failingPayments = Object.create(paymentDeps.payments) as MongoPaymentRepository;
    failingPayments.create = async () => {
      throw new Error("Simulated payment DB failure");
    };

    const failingUseCase = new ReceivePaymentUseCase({
      ...paymentDeps,
      payments: failingPayments,
    });

    await expect(
      runInOrganizationContext(shop.organizationId, () =>
        failingUseCase.execute({
          organizationId: shop.organizationId,
          locationId: asId(shop.locationId),
          method: PAYMENT_METHOD.CASH,
          amount: { amount: 10000, currency: "BDT" },
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: link.requestId,
              amount: { amount: 10000, currency: "BDT" },
            },
          ],
          contactId,
          receivedByMemberId: shop.memberId,
          actorUserId: shop.userId,
        }),
      ),
    ).rejects.toThrow("Simulated payment DB failure");

    // Verify booking state and payment fence were rolled back!
    const bookingAfter = await runInOrganizationContext(shop.organizationId, () =>
      bookings.findById(asId(link.requestId)),
    );
    expect(bookingAfter?.status).toBe(BOOKING_STATUS.HELD);
    expect(bookingAfter?.paymentFenceVersion).toBe(0);
  });

  it("enforces cross-org isolation: payment receipt fails for request belonging to another organization", async () => {
    const { world, shop, service, contactId, commands, receivePaymentUseCase } =
      await setupShop("cross-org");

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));

    // Attempt to receive payment under Organization B for the booking of Organization A
    await expect(
      runInOrganizationContext(world.organizationB, () =>
        receivePaymentUseCase.execute({
          organizationId: asId<OrganizationId>(world.organizationB),
          locationId: asId<LocationId>(world.locationB1),
          method: PAYMENT_METHOD.CASH,
          amount: { amount: 10000, currency: "BDT" },
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: link.requestId,
              amount: { amount: 10000, currency: "BDT" },
            },
          ],
          contactId,
          receivedByMemberId: shop.memberId,
          actorUserId: shop.userId,
        }),
      ),
    ).rejects.toThrow();
  });
});
