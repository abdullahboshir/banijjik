import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import type { BookingController } from "./booking.controller.js";
import { mountBookingRoutes } from "./booking-tenant-booking.routes.js";
import { mountBookingResourceRoutes } from "./booking-tenant-resource.routes.js";

export interface BookingRouterDependencies {
  readonly controller: BookingController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

export function buildBookingTenantRouter(input: BookingRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountBookingResourceRoutes({
    router,
    controller: input.controller,
    permission: input.permission,
  });
  mountBookingRoutes({
    router,
    controller: input.controller,
    permission: input.permission,
    idempotency: input.idempotency,
  });
  return router;
}
