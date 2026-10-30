import {
  BOOKING_STATUS,
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_REQUIRE_APPROVAL_SETTING_KEY,
  BOOKING_HOLD_MINUTES_SETTING_KEY,
  DEPOSIT_REQUIRED,
} from "@banijjik/contracts/booking";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import type {
  CheckoutSelection,
  PublicBookingCommands,
  StorefrontCommandContext,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { addCustomer, setSetting, shopOf } from "../../../test-support/sales-api-world.js";
import {
  publishBookableService,
  createStylistResource,
  SUNDAY_SCHEDULE,
} from "../../../test-support/booking-api-world.js";
import { buildBookingTenantPorts } from "../../../routes/booking-tenant-router.js";
import { buildStorefrontBookingCommands, buildBookingPaymentLifecycle } from "./index.js";
import { MongoBookingRepository } from "./infrastructure/mongo-booking.repositories.js";
import { MongoResourceRepository } from "./infrastructure/mongo-booking.repositories.js";
import { MongoResourceSlotUsageRepository } from "./infrastructure/mongo-slot-usage.repository.js";
import { MongoEventSessionRepository } from "./infrastructure/mongo-event-session.repository.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { buildBookingOfferingReader } from "./infrastructure/booking-catalog-adapter.js";
import { buildBookingSettingsReader } from "./application/booking-settings-reader.js";
import { buildOrganizationTimezoneReader } from "./infrastructure/booking-org-adapter.js";
import { buildExpireHoldsJob } from "./application/jobs/expire-holds.job.js";
import { MongoPaymentSummaryRepository } from "../payment/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { buildModuleRegistry, MODULE_MANIFESTS } from "../../../routes/module-registry.js";
import { buildOrgConfigService } from "../../platform/entitlement/index.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../routes/organization-config-ports.js";
import { buildIndustryTemplateReader } from "../../platform/industry/index.js";
import { buildAuditRecorder } from "../../core/audit/index.js";

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

describe("PublicBookingCommands.request and BookingPaymentLifecyclePort", () => {
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

    const deps = {
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

    const rawCommands = buildStorefrontBookingCommands(deps);
    const commands: PublicBookingCommands = {
      request: (context, input) =>
        runInOrganizationContext(context.organizationId, () => rawCommands.request(context, input)),
    };

    const rawLifecycle = buildBookingPaymentLifecycle({
      bookings,
      unitOfWork,
      depositCheck: ports.depositCheck,
      settings,
      events,
      audit,
    });

    const lifecycle = {
      beginReceipt: (input: { organizationId: string; bookingId: string; now: Date }) =>
        runInOrganizationContext(input.organizationId, () => rawLifecycle.beginReceipt(input)),
      endReceipt: (input: { organizationId: string; bookingId: string; now: Date }) =>
        runInOrganizationContext(input.organizationId, () => rawLifecycle.endReceipt(input)),
    };

    return { world, shop, service, contactId, commands, lifecycle, deps, ports };
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

  it("creates booking in HELD status with holdExpiresAt for offering requiring deposit", async () => {
    const { shop, service, contactId, commands, deps } = await setupShop("held-deposit");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, 15);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));

    expect(link.requestType).toBe("BOOKING");
    expect(link.status).toBe(BOOKING_STATUS.HELD);
    expect(link.paymentRequired.amount).toBe(10000);
    expect(link.holdExpiresAt).toBeDefined();

    const booking = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    expect(booking?.status).toBe(BOOKING_STATUS.HELD);
    expect(booking?.checkoutId).toBe(context.checkoutId);
  });

  it("initializes payment summary idempotently during hold transaction", async () => {
    const { shop, service, contactId, commands } = await setupShop("hold-summary");
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

    const summaries = new MongoPaymentSummaryRepository();
    const summary = await runInOrganizationContext(shop.organizationId, () =>
      summaries.findByRequest(
        asId<OrganizationId>(shop.organizationId),
        PAYMENT_REQUEST_TYPE.BOOKING,
        link.requestId,
      ),
    );
    expect(summary).toBeDefined();
    expect(summary?.total.amount).toBe(50000);
  });

  it("transitions booking to REQUESTED when deposit is zero and requireApproval is true", async () => {
    const { shop, service, contactId, commands, deps } = await setupShop("zero-dep-approval");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.NONE);
    await setSetting(shop, BOOKING_REQUIRE_APPROVAL_SETTING_KEY, true);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));

    expect(link.status).toBe(BOOKING_STATUS.REQUESTED);
    expect(link.paymentRequired.amount).toBe(0);

    const booking = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    expect(booking?.status).toBe(BOOKING_STATUS.REQUESTED);
  });

  it("transitions booking to CONFIRMED when deposit is zero and requireApproval is false", async () => {
    const { shop, service, contactId, commands, deps } = await setupShop("zero-dep-no-approval");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.NONE);
    await setSetting(shop, BOOKING_REQUIRE_APPROVAL_SETTING_KEY, false);

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };

    const link = await commands.request(context, sampleSelection(service));

    expect(link.status).toBe(BOOKING_STATUS.CONFIRMED);
    expect(link.publicNumber).toMatch(/^\d{6}$/);

    const booking = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    expect(booking?.status).toBe(BOOKING_STATUS.CONFIRMED);
    expect(booking?.bookingNumber).toBe(link.publicNumber);
  });

  it("beginReceipt increments paymentFenceVersion and allows deposit payment on active hold", async () => {
    const { shop, service, contactId, commands, lifecycle, deps } = await setupShop("fence-active");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);

    const link = await commands.request(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      sampleSelection(service),
    );

    const initial = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    expect(initial?.paymentFenceVersion).toBe(0);

    await lifecycle.beginReceipt({
      organizationId: shop.organizationId,
      bookingId: link.requestId,
      now: harness.clock.now(),
    });

    const fenced = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    expect(fenced?.paymentFenceVersion).toBe(1);
  });

  it("beginReceipt rejects payment when hold is expired before expiry worker runs", async () => {
    const { shop, service, contactId, commands, lifecycle } = await setupShop("fence-expired");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, 5);

    const link = await commands.request(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      sampleSelection(service),
    );

    const pastExpiry = new Date(Date.now() + 10 * 60_000);

    await expect(
      lifecycle.beginReceipt({
        organizationId: shop.organizationId,
        bookingId: link.requestId,
        now: pastExpiry,
      }),
    ).rejects.toThrow("BOOKING_HOLD_EXPIRED");
  });

  it("beginReceipt rejects payment when booking is in terminal status (CANCELLED, COMPLETED, EXPIRED)", async () => {
    const { shop, service, contactId, commands, lifecycle, deps } =
      await setupShop("fence-terminal");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);

    const link = await commands.request(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      sampleSelection(service),
    );

    const booking = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    if (!booking) {
      throw new Error("Booking not found");
    }
    const cancelled = booking.transition("cancel", {
      now: harness.clock.now(),
      actorUserId: null,
      note: "Cancelled in test",
    });
    await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.update(cancelled, booking.version),
    );

    await expect(
      lifecycle.beginReceipt({
        organizationId: shop.organizationId,
        bookingId: link.requestId,
        now: harness.clock.now(),
      }),
    ).rejects.toThrow("BOOKING_PAYMENT_FENCE_CONFLICT");
  });

  it("endReceipt transitions HELD booking to REQUESTED or CONFIRMED when deposit is satisfied", async () => {
    const { shop, service, contactId, commands, lifecycle, deps } =
      await setupShop("end-receipt-satisfied");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);
    await setSetting(shop, BOOKING_REQUIRE_APPROVAL_SETTING_KEY, false);

    const link = await commands.request(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      sampleSelection(service),
    );

    // Mock deposit satisfied:
    const originalIsDepositSatisfied = deps.depositCheck.isDepositSatisfied;
    deps.depositCheck.isDepositSatisfied = async () => true;

    try {
      await lifecycle.endReceipt({
        organizationId: shop.organizationId,
        bookingId: link.requestId,
        now: harness.clock.now(),
      });

      const updated = await runInOrganizationContext(shop.organizationId, () =>
        deps.bookings.findById(asId(link.requestId)),
      );
      expect(updated?.status).toBe(BOOKING_STATUS.CONFIRMED);
      expect(updated?.bookingNumber).toMatch(/^\d{6}$/);
    } finally {
      deps.depositCheck.isDepositSatisfied = originalIsDepositSatisfied;
    }
  });

  it("expire-holds job settles partial advances with fee NONE, releases capacity, and emits outbox atomically", async () => {
    const { shop, service, contactId, commands, deps } = await setupShop("expire-job");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, 5);

    const link = await commands.request(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      sampleSelection(service),
    );

    let terminationSettled = false;
    let feeModeUsed: string | undefined;
    const originalSettle = deps.depositCheck.settleBookingTermination;
    deps.depositCheck.settleBookingTermination = async (input) => {
      terminationSettled = true;
      feeModeUsed = input.feeMode;
      return { feeRetained: null };
    };

    try {
      const expireJob = buildExpireHoldsJob({
        bookings: deps.bookings,
        slots: deps.slots,
        sessions: deps.sessions,
        unitOfWork: deps.unitOfWork,
        events: deps.events,
        clock: deps.clock,
        depositCheck: deps.depositCheck,
      });

      const future = new Date(Date.now() + 15 * 60_000);
      await runInOrganizationContext(shop.organizationId, () =>
        expireJob.run(shop.organizationId, future),
      );

      const expired = await runInOrganizationContext(shop.organizationId, () =>
        deps.bookings.findById(asId(link.requestId)),
      );
      expect(expired?.status).toBe(BOOKING_STATUS.EXPIRED);
      expect(terminationSettled).toBe(true);
      expect(feeModeUsed).toBe("NONE");
    } finally {
      deps.depositCheck.settleBookingTermination = originalSettle;
    }
  });

  it("expire-holds job respects payment fence and does not expire booking during active receipt", async () => {
    const { shop, service, contactId, commands, lifecycle, deps } =
      await setupShop("fence-safe-expire");
    await setSetting(shop, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, DEPOSIT_REQUIRED.FIXED);
    await setSetting(shop, BOOKING_DEPOSIT_VALUE_SETTING_KEY, 10000);
    await setSetting(shop, BOOKING_HOLD_MINUTES_SETTING_KEY, 5);

    const link = await commands.request(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      sampleSelection(service),
    );

    // Active receipt begins and increments paymentFenceVersion:
    await lifecycle.beginReceipt({
      organizationId: shop.organizationId,
      bookingId: link.requestId,
      now: harness.clock.now(),
    });

    const expireJob = buildExpireHoldsJob({
      bookings: deps.bookings,
      slots: deps.slots,
      sessions: deps.sessions,
      unitOfWork: deps.unitOfWork,
      events: deps.events,
      clock: deps.clock,
      depositCheck: deps.depositCheck,
    });

    // Run expire holds:
    const future = new Date(Date.now() + 15 * 60_000);
    await runInOrganizationContext(shop.organizationId, () =>
      expireJob.run(shop.organizationId, future),
    );

    // Because paymentFenceVersion changed, expire-holds job respects the fence and leaves booking as HELD:
    const booking = await runInOrganizationContext(shop.organizationId, () =>
      deps.bookings.findById(asId(link.requestId)),
    );
    expect(booking?.status).toBe(BOOKING_STATUS.HELD);
  });

  it("rejects booking request for disabled booking kind, offering, or inactive location", async () => {
    const { shop, contactId, commands } = await setupShop("disabled-checks");

    // Invalid selection kind (PRODUCT sent to booking):
    await expect(
      commands.request(
        {
          organizationId: shop.organizationId,
          locationId: shop.locationId,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-invalid-kind",
          selection: {
            kind: "PRODUCT",
            offeringId: newId(),
            variantId: newId(),
            quantity: 1,
            modifierOptionIds: [],
          } as unknown as CheckoutSelection["selection"],
          customFields: {},
        },
      ),
    ).rejects.toThrow();

    // Unknown offering:
    await expect(
      commands.request(
        {
          organizationId: shop.organizationId,
          locationId: shop.locationId,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-unknown-offering",
          selection: {
            kind: "SERVICE",
            offeringId: newId(),
            variantId: newId(),
            startsAt: SUNDAY_DATE,
            resourceIds: [],
          },
          customFields: {},
        },
      ),
    ).rejects.toThrow();
  });

  it("enforces cross-organization isolation: cannot request booking in location of another organization", async () => {
    const { shop, service, contactId, commands } = await setupShop("cross-org-booking");
    const otherWorld = await worldFor(harness, RETAIL, SALON);

    await expect(
      commands.request(
        {
          organizationId: otherWorld.organizationB,
          locationId: shop.locationId, // location belongs to shop (organization A)
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        sampleSelection(service),
      ),
    ).rejects.toThrow();
  });
});
