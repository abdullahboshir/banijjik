import { MongoResourceRepository } from "./infrastructure/mongo-booking.repositories.js";
import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { EventSessionUseCases } from "./application/use-cases/event-session.use-cases.js";
import { buildBookingOfferingReader } from "./infrastructure/booking-catalog-adapter.js";
import { MongoEventSessionRepository } from "./infrastructure/mongo-event-session.repository.js";
import { buildEventSessionRoutes } from "./presentation/event-session.router.js";

export function buildEventSessionRouter(input: {
  clock: Clock;
  permission: PermissionMiddlewareFactory;
  audit: AuditRecorder;
}): Router {
  return buildEventSessionRoutes({
    permission: input.permission,
    useCases: new EventSessionUseCases({
      sessions: new MongoEventSessionRepository(),
      resources: new MongoResourceRepository(),
      offerings: buildBookingOfferingReader(),
      unitOfWork: new MongoUnitOfWork(),
      events: kernelEventPublisher,
      audit: input.audit,
      clock: input.clock,
    }),
  });
}
