import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  resourceArchiveRequestSchema,
  resourceCreateRequestSchema,
  resourceIdParamsSchema,
  resourceListQuerySchema,
  resourceTimeOffCreateRequestSchema,
  resourceUpdateRequestSchema,
} from "@banijjik/validation/booking";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { BookingController } from "./booking.controller.js";

export function mountBookingResourceRoutes(input: {
  router: Router;
  controller: BookingController;
  permission: PermissionMiddlewareFactory;
}): void {
  input.router.get(
    "/resources",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_READ),
    validate({ query: resourceListQuerySchema }),
    input.controller.listResources,
  );
  input.router.post(
    "/resources",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_CREATE),
    validate({ body: resourceCreateRequestSchema }),
    input.controller.createResource,
  );
  input.router.get(
    "/resources/:resourceId",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_READ),
    validate({ params: resourceIdParamsSchema }),
    input.controller.getResource,
  );
  input.router.patch(
    "/resources/:resourceId",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_UPDATE),
    validate({ params: resourceIdParamsSchema, body: resourceUpdateRequestSchema }),
    input.controller.updateResource,
  );
  input.router.get(
    "/resources/:resourceId/time-off",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_READ),
    validate({ params: resourceIdParamsSchema }),
    input.controller.listResourceTimeOff,
  );
  input.router.post(
    "/resources/:resourceId/time-off",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_UPDATE),
    validate({ params: resourceIdParamsSchema, body: resourceTimeOffCreateRequestSchema }),
    input.controller.createResourceTimeOff,
  );
  input.router.post(
    "/resources/:resourceId/archive",
    input.permission(PERMISSION_KEY.BOOKING_RESOURCE_ARCHIVE),
    validate({ params: resourceIdParamsSchema, body: resourceArchiveRequestSchema }),
    input.controller.archiveResource,
  );
}
