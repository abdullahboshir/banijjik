import type { RequestHandler, Router } from "express";
import type { ModuleManifest } from "@banijjik/contracts";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import { GetAvailabilityUseCase } from "./application/use-cases/get-availability.use-case.js";
import { GetPublicAvailabilityUseCase } from "./application/use-cases/get-public-availability.use-case.js";
import { buildBookingSettingsReader } from "./application/booking-settings-reader.js";
import { buildBookingOfferingReader } from "./infrastructure/booking-catalog-adapter.js";
import { buildOrganizationTimezoneReader } from "./infrastructure/booking-org-adapter.js";
import { MongoResourceRepository } from "./infrastructure/mongo-booking.repositories.js";
import { MongoResourceSlotUsageRepository } from "./infrastructure/mongo-slot-usage.repository.js";
import { MongoResourceTimeOffRepository } from "./infrastructure/mongo-resource-timeoff.repository.js";
import { buildBookingStorefrontRouter } from "./presentation/booking-storefront.router.js";

/** Public storefront availability composition (mounted from `routes/storefront.ts` via `index.ts`). */
export function buildBookingStorefront(input: {
  readonly orgConfig: OrgConfigService;
  readonly requireBookingModule: RequestHandler;
  readonly clock: Clock;
  readonly manifests: readonly ModuleManifest[];
  readonly readPublicLocationIds: (organizationId: string) => Promise<readonly string[]>;
}): Router {
  const resources = new MongoResourceRepository();
  const slots = new MongoResourceSlotUsageRepository();
  const timeOff = new MongoResourceTimeOffRepository();
  const getAvailability = new GetAvailabilityUseCase({
    resources,
    slots,
    offerings: buildBookingOfferingReader(),
    settings: buildBookingSettingsReader({
      orgConfig: input.orgConfig,
      manifests: input.manifests,
    }),
    timeZone: buildOrganizationTimezoneReader(),
    timeOff: {
      listOverlapping: (resourceId, from, to) => timeOff.listOverlapping({ resourceId, from, to }),
    },
    clock: input.clock,
  });
  return buildBookingStorefrontRouter({
    requireBookingModule: input.requireBookingModule,
    getPublicAvailability: new GetPublicAvailabilityUseCase(getAvailability),
    readPublicLocationIds: input.readPublicLocationIds,
  });
}
