import { BOOKING_SOURCE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import {
  asId,
  newId,
  type ContactId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { systemClock } from "../../../../kernel/time/index.js";
import { MODULE_KEY } from "@banijjik/contracts";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import { bookingManifest } from "../module.manifest.js";
import { Booking } from "../domain/booking.entity.js";
import { Resource } from "../domain/resource.entity.js";
import { MongoBookingRepository, MongoResourceRepository } from "./mongo-booking.repositories.js";
import { MongoResourceSlotUsageRepository } from "./mongo-slot-usage.repository.js";
import { buildExpireHoldsJob } from "../application/jobs/expire-holds.job.js";
import { buildMarkNoShowsJob } from "../application/jobs/mark-no-shows.job.js";
import type { BookingEventPublisher } from "../application/use-cases/create-booking.use-case.js";
import type { DepositCheckPort } from "../application/ports/payment-ports.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };

const zeroPrice = {
  unitPrice: { amount: 0, currency: "BDT" as const },
  total: { amount: 0, currency: "BDT" as const },
  tax: { amount: 0, currency: "BDT" as const },
  currency: "BDT" as const,
};

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function noopEvents(): BookingEventPublisher {
  return { publish: vi.fn(async () => undefined) };
}

describe("booking scheduled jobs", () => {
  it("expires holds idempotently and releases buckets", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const organizationRef = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00.000Z");
    const blockedEndsAt = new Date("2026-11-01T04:30:00.000Z");
    const now = new Date("2026-11-01T05:00:00.000Z");

    await runInOrganizationContext(world.organizationA, async () => {
      const resources = new MongoResourceRepository();
      const resource = Resource.create({
        organizationId: organizationRef,
        locationId,
        resourceTypeKey: "STYLIST",
        name: "Chair",
        memberId: null,
        capacity: 1,
        weeklySchedule: [{ weekday: 7, opensAt: "09:00", closesAt: "18:00" }],
        offeringIds: [asId<OfferingId>(newId())],
        now,
        actorUserId: null,
      });
      await resources.insert(resource);
      const resourceId = resource.resourceId;

      const slots = new MongoResourceSlotUsageRepository();
      await slots.takeCapacity({
        organizationId: organizationRef,
        resourceId,
        capacity: 1,
        startsAt,
        blockedEndsAt,
      });

      const bookings = new MongoBookingRepository();
      const hold = Booking.createHold({
        organizationId: organizationRef,
        locationId,
        contactId: asId<ContactId>(newId()),
        offeringId: asId<OfferingId>(newId()),
        variantId: newId(),
        depositRequired: { amount: 0, currency: "BDT" },
        startsAt,
        endsAt: blockedEndsAt,
        blockedEndsAt,
        resourceIds: [resourceId],
        providerMemberId: null,
        price: zeroPrice,
        holdExpiresAt: new Date("2026-11-01T03:00:00.000Z"),
        note: null,
        source: BOOKING_SOURCE.STOREFRONT,
        now,
        actorUserId: null,
      });
      await bookings.insert(hold);

      const job = buildExpireHoldsJob({
        bookings,
        slots,
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        clock: systemClock,
      });

      await job.run(organizationRef, now);
      await job.run(organizationRef, now);

      const updated = await bookings.findById(hold.bookingId);
      expect(updated?.status).toBe(BOOKING_STATUS.EXPIRED);
      await expect(
        slots.takeCapacity({
          organizationId: organizationRef,
          resourceId,
          capacity: 1,
          startsAt,
          blockedEndsAt,
        }),
      ).resolves.toBeUndefined();
    });
  });

  it("marks no-shows idempotently", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const organizationRef = asId<OrganizationId>(world.organizationA);
    const locationId = asId<LocationId>(world.locationA1);
    const startsAt = new Date("2026-11-01T04:00:00.000Z");
    const blockedEndsAt = new Date("2026-11-01T04:30:00.000Z");
    const now = new Date("2026-11-01T06:00:00.000Z");
    const orgConfig = {
      current: async () => ({ modules: [MODULE_KEY.BOOKING] }),
    } as unknown as OrgConfigService;

    await runInOrganizationContext(world.organizationA, async () => {
      const resources = new MongoResourceRepository();
      const resource = Resource.create({
        organizationId: organizationRef,
        locationId,
        resourceTypeKey: "STYLIST",
        name: "Chair",
        memberId: null,
        capacity: 1,
        weeklySchedule: [{ weekday: 7, opensAt: "09:00", closesAt: "18:00" }],
        offeringIds: [asId<OfferingId>(newId())],
        now: startsAt,
        actorUserId: null,
      });
      await resources.insert(resource);
      const resourceId = resource.resourceId;

      const slots = new MongoResourceSlotUsageRepository();
      await slots.takeCapacity({
        organizationId: organizationRef,
        resourceId,
        capacity: 1,
        startsAt,
        blockedEndsAt,
      });

      const bookings = new MongoBookingRepository();
      const confirmed = Booking.createStaff({
        organizationId: organizationRef,
        locationId,
        contactId: asId<ContactId>(newId()),
        offeringId: asId<OfferingId>(newId()),
        variantId: newId(),
        depositRequired: { amount: 0, currency: "BDT" },
        startsAt,
        endsAt: blockedEndsAt,
        blockedEndsAt,
        resourceIds: [resourceId],
        providerMemberId: null,
        price: zeroPrice,
        status: BOOKING_STATUS.CONFIRMED,
        bookingNumber: "B-1",
        note: null,
        now: startsAt,
        actorUserId: null,
      });
      await bookings.insert(confirmed);

      const noopDepositCheck: DepositCheckPort = {
        isDepositSatisfied: async () => true,
        initializeSummary: async () => {},
        settleBookingTermination: async () => ({ feeRetained: null }),
      };

      const job = buildMarkNoShowsJob({
        bookings,
        slots,
        unitOfWork: new MongoUnitOfWork(),
        events: noopEvents(),
        orgConfig,
        manifests: [bookingManifest],
        depositCheck: noopDepositCheck,
      });

      await job.run(organizationRef, now);
      await job.run(organizationRef, now);

      const updated = await bookings.findById(confirmed.bookingId);
      expect(updated?.status).toBe(BOOKING_STATUS.NO_SHOW);
    });
  });
});
