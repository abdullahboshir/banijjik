import type { ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import { buildBookingPostingSource } from "./application/booking-posting-source.js";
import { buildBookingController } from "./build-booking-controller.js";
import { buildExpireHoldsJob } from "./application/jobs/expire-holds.job.js";
import { buildMarkNoShowsJob } from "./application/jobs/mark-no-shows.job.js";
import { MongoBookingRepository } from "./infrastructure/mongo-booking.repositories.js";
import { MongoResourceSlotUsageRepository } from "./infrastructure/mongo-slot-usage.repository.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import { buildBookingTenantRouter } from "./presentation/booking-tenant.router.js";
import type { ContactCreator, PriceQuoterPort } from "./application/ports/booking-context-ports.js";

export { bookingManifest } from "./module.manifest.js";
export { registerBookingModels } from "./infrastructure/register-booking-models.js";
export { buildBookingPostingSource };
export type { BookingPostingSource } from "../accounting/index.js";

export function buildBookingPostingSourceAdapter(): import("../accounting/index.js").BookingPostingSource {
  return buildBookingPostingSource({ bookings: new MongoBookingRepository() });
}

export interface BookingTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly quoter: PriceQuoterPort;
  readonly contacts: ContactCreator;
}

export function buildBookingRouter(dependencies: BookingTenantDependencies): Router {
  const controller = buildBookingController(dependencies);
  return buildBookingTenantRouter({
    controller,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}

export function registerBookingScheduledJobs(input: {
  readonly clock: Clock;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}): void {
  const bookings = new MongoBookingRepository();
  const slots = new MongoResourceSlotUsageRepository();
  const unitOfWork = new MongoUnitOfWork();
  registerScheduledJob(
    buildExpireHoldsJob({
      bookings,
      slots,
      unitOfWork,
      events: kernelEventPublisher,
      clock: input.clock,
    }),
  );
  registerScheduledJob(
    buildMarkNoShowsJob({
      bookings,
      slots,
      unitOfWork,
      events: kernelEventPublisher,
      orgConfig: input.orgConfig,
      manifests: input.manifests,
    }),
  );
}
