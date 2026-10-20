import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  availabilityQuerySchema,
  bookingCancelRequestSchema,
  bookingCreateRequestSchema,
  bookingHoldRequestSchema,
  bookingIdParamsSchema,
  bookingListQuerySchema,
  bookingRescheduleRequestSchema,
  bookingTransitionRequestSchema,
} from "@banijjik/validation/booking";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { BookingController } from "./booking.controller.js";

function mountBookingReadRoutes(input: {
  router: Router;
  controller: BookingController;
  permission: PermissionMiddlewareFactory;
}): void {
  input.router.get(
    "/availability",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_READ),
    validate({ query: availabilityQuerySchema }),
    input.controller.availability,
  );
  input.router.get(
    "/bookings",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_READ),
    validate({ query: bookingListQuerySchema }),
    input.controller.list,
  );
  input.router.get(
    "/bookings/:bookingId",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_READ),
    validate({ params: bookingIdParamsSchema }),
    input.controller.get,
  );
}

function mountBookingCreateRoutes(input: {
  router: Router;
  controller: BookingController;
  permission: PermissionMiddlewareFactory;
  idempotency: RequestHandler;
}): void {
  input.router.post(
    "/bookings/holds",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_CREATE),
    validate({ body: bookingHoldRequestSchema }),
    input.idempotency,
    input.controller.hold,
  );
  input.router.post(
    "/bookings",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_CREATE),
    validate({ body: bookingCreateRequestSchema }),
    input.idempotency,
    input.controller.create,
  );
}

function mountBookingTransitionRoutes(input: {
  router: Router;
  controller: BookingController;
  permission: PermissionMiddlewareFactory;
}): void {
  input.router.post(
    "/bookings/:bookingId/confirm",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_UPDATE),
    validate({ params: bookingIdParamsSchema, body: bookingTransitionRequestSchema }),
    input.controller.confirm,
  );
  input.router.post(
    "/bookings/:bookingId/request",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_UPDATE),
    validate({ params: bookingIdParamsSchema, body: bookingTransitionRequestSchema }),
    input.controller.requestFromHold,
  );
  input.router.post(
    "/bookings/:bookingId/check-in",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_UPDATE),
    validate({ params: bookingIdParamsSchema, body: bookingTransitionRequestSchema }),
    input.controller.checkIn,
  );
  input.router.post(
    "/bookings/:bookingId/complete",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_UPDATE),
    validate({ params: bookingIdParamsSchema, body: bookingTransitionRequestSchema }),
    input.controller.complete,
  );
  input.router.post(
    "/bookings/:bookingId/no-show",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_UPDATE),
    validate({ params: bookingIdParamsSchema, body: bookingTransitionRequestSchema }),
    input.controller.noShow,
  );
  input.router.post(
    "/bookings/:bookingId/reschedule",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_RESCHEDULE),
    validate({ params: bookingIdParamsSchema, body: bookingRescheduleRequestSchema }),
    input.controller.reschedule,
  );
  input.router.post(
    "/bookings/:bookingId/cancel",
    input.permission(PERMISSION_KEY.BOOKING_BOOKING_CANCEL),
    validate({ params: bookingIdParamsSchema, body: bookingCancelRequestSchema }),
    input.controller.cancel,
  );
}

export function mountBookingRoutes(input: {
  router: Router;
  controller: BookingController;
  permission: PermissionMiddlewareFactory;
  idempotency: RequestHandler;
}): void {
  mountBookingReadRoutes(input);
  mountBookingCreateRoutes(input);
  mountBookingTransitionRoutes(input);
}
