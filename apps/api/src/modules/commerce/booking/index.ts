import type { Router } from "express";
import type { ModuleManifest } from "@banijjik/contracts";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import type { DepositCheckPort } from "./application/ports/payment-ports.js";
import { buildBookingPostingSource } from "./application/booking-posting-source.js";
import { buildBookingController } from "./build-booking-controller.js";
import { buildExpireHoldsJob } from "./application/jobs/expire-holds.job.js";
import { buildMarkNoShowsJob } from "./application/jobs/mark-no-shows.job.js";
import { buildAutoCompleteJob } from "./application/jobs/auto-complete.job.js";
import { buildCancelEventSessionJob } from "./application/jobs/cancel-event-session-bookings.job.js";
import { MongoEventSessionRepository } from "./infrastructure/mongo-event-session.repository.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { MongoBookingRepository } from "./infrastructure/mongo-booking.repositories.js";
import { MongoResourceSlotUsageRepository } from "./infrastructure/mongo-slot-usage.repository.js";
import { buildOrganizationTimezoneReader } from "./infrastructure/booking-org-adapter.js";
import { buildRequestAdvanceReader } from "../payment/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import { buildBookingTenantRouter } from "./presentation/booking-tenant.router.js";

export { bookingManifest } from "./module.manifest.js";

export { businessDateOf } from "./domain/timezone.js";
export { MongoResourceExclusiveHolds } from "./infrastructure/mongo-resource-exclusive-holds.js";
export type { ResourceExclusiveHoldPort } from "./application/ports/resource-exclusive-holds.js";
export { registerBookingModels } from "./infrastructure/register-booking-models.js";
export { buildBookingPostingSource };
export { buildConfirmedBookingReader } from "./build-confirmed-booking-reader.js";
export function buildBookingReader(): Pick<
  import("./application/ports/booking-repositories.js").BookingRepository,
  "findById"
> {
  const bookings = new MongoBookingRepository();
  return { findById: (bookingId) => bookings.findById(bookingId) };
}
export function buildMarkNoShowsJobWithPersistence(
  input: Omit<Parameters<typeof buildMarkNoShowsJob>[0], "bookings">,
): ReturnType<typeof buildMarkNoShowsJob> {
  return buildMarkNoShowsJob({ ...input, bookings: new MongoBookingRepository() });
}
export { MongoResourceSlotUsageRepository };
export { buildExpireHoldsJob, buildMarkNoShowsJob };
export type { BookingPostingSource } from "../accounting/index.js";

export function buildBookingPostingSourceAdapter(): import("../accounting/index.js").BookingPostingSource {
  return buildBookingPostingSource({
    bookings: new MongoBookingRepository(),
    advances: buildRequestAdvanceReader(),
    timeZone: buildOrganizationTimezoneReader(),
  });
}

import type { BookingTenantDependencies } from "./booking-tenant-dependencies.js";
export type { BookingTenantDependencies };
export type { DepositCheckPort, PaymentStatusReader } from "./application/ports/payment-ports.js";
export {
  computeCancelDepositDisposition,
  computeNoShowDepositDisposition,
  type DepositDisposition,
} from "./domain/deposit.js";

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
  readonly depositCheck: DepositCheckPort;
  readonly audit?: AuditRecorder;
}): void {
  const bookings = new MongoBookingRepository();
  const slots = new MongoResourceSlotUsageRepository();
  const sessions = new MongoEventSessionRepository();
  const unitOfWork = new MongoUnitOfWork();
  const audit = input.audit ?? buildAuditRecorder(input.clock);
  registerScheduledJob(
    buildExpireHoldsJob({
      bookings,
      slots,
      sessions,
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
      depositCheck: input.depositCheck,
    }),
  );
  registerScheduledJob(
    buildAutoCompleteJob({
      bookings,
      sessions,
      unitOfWork,
      events: kernelEventPublisher,
      audit,
      orgConfig: input.orgConfig,
      manifests: input.manifests,
    }),
  );
  registerScheduledJob(
    buildCancelEventSessionJob({
      sessions,
      bookings,
      slots,
      unitOfWork,
      events: kernelEventPublisher,
      audit,
      depositCheck: input.depositCheck,
    }),
  );
}

export { buildEventSessionRouter } from "./build-event-session-router.js";
export {
  buildStorefrontBookingCommands,
  type BookingStorefrontDependencies,
} from "./application/storefront-booking-commands.js";
export {
  buildBookingPaymentLifecycle,
  type BookingPaymentLifecyclePort,
  type BookingPaymentLifecycleDependencies,
} from "./application/booking-payment-lifecycle.js";
