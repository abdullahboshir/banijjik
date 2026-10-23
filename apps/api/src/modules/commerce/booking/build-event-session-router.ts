import { MongoResourceRepository } from "./infrastructure/mongo-booking.repositories.js";
import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { EventSessionUseCases } from "./application/use-cases/event-session.use-cases.js";
import { buildEventSessionOfferingReader } from "./infrastructure/event-session-offering-adapter.js";
import { MongoEventSessionRepository } from "./infrastructure/mongo-event-session.repository.js";
import { buildEventSessionRoutes } from "./presentation/event-session.router.js";

export function buildEventSessionRouter(input: {
  clock: Clock;
  permission: PermissionMiddlewareFactory;
}): Router {
  return buildEventSessionRoutes({
    permission: input.permission,
    useCases: new EventSessionUseCases({
      sessions: new MongoEventSessionRepository(),
      resources: new MongoResourceRepository(),
      offerings: buildEventSessionOfferingReader(),
      clock: input.clock,
    }),
  });
}
