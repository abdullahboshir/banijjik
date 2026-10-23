import { PERMISSION_KEY } from "@banijjik/contracts";
import { asId, type EventSessionId } from "@banijjik/ids";
import {
  eventSessionCreateSchema,
  eventSessionUpdateSchema,
  eventSessionVersionSchema,
  eventSessionParamsSchema,
  eventSessionListSchema,
} from "@banijjik/validation/booking";
import { Router } from "express";
import {
  readTenantCaller,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type { EventSessionUseCases } from "../application/use-cases/event-session.use-cases.js";

export function buildEventSessionRoutes(input: {
  useCases: EventSessionUseCases;
  permission: PermissionMiddlewareFactory;
}): Router {
  const router = Router({ mergeParams: true });
  const { useCases } = input;
  router.get(
    "/event-sessions",
    input.permission(PERMISSION_KEY.BOOKING_EVENT_SESSION_READ),
    validate({ query: eventSessionListSchema }),
    async (request, response) => {
      const query = eventSessionListSchema.parse(request.query);
      const page = await useCases.list(query, readTenantCaller().allowedLocationIds);
      sendData(
        response,
        page.items.map((session) => session.toProps()),
        { meta: { page: query.page, limit: query.limit, hasNext: page.hasNext } },
      );
    },
  );
  router.post(
    "/event-sessions",
    input.permission(PERMISSION_KEY.BOOKING_EVENT_SESSION_CREATE),
    validate({ body: eventSessionCreateSchema }),
    async (request, response) => {
      const session = await useCases.create({
        ...readTenantCaller(),
        body: eventSessionCreateSchema.parse(request.body),
      });
      sendData(response, session.toProps(), { status: 201 });
    },
  );
  router.get(
    "/event-sessions/:eventSessionId",
    input.permission(PERMISSION_KEY.BOOKING_EVENT_SESSION_READ),
    validate({ params: eventSessionParamsSchema }),
    async (request, response) => {
      const { eventSessionId } = eventSessionParamsSchema.parse(request.params);
      const session = await useCases.get(
        asId<EventSessionId>(eventSessionId),
        readTenantCaller().allowedLocationIds,
      );
      sendData(response, session.toProps());
    },
  );
  mountSessionChanges(router, input);
  return router;
}

function mountSessionChanges(
  router: Router,
  input: { useCases: EventSessionUseCases; permission: PermissionMiddlewareFactory },
): void {
  const { useCases } = input;
  router.patch(
    "/event-sessions/:eventSessionId",
    input.permission(PERMISSION_KEY.BOOKING_EVENT_SESSION_UPDATE),
    validate({ params: eventSessionParamsSchema, body: eventSessionUpdateSchema }),
    async (request, response) => {
      const { eventSessionId } = eventSessionParamsSchema.parse(request.params);
      const session = await useCases.update({
        ...readTenantCaller(),
        eventSessionId: asId<EventSessionId>(eventSessionId),
        body: eventSessionUpdateSchema.parse(request.body),
      });
      sendData(response, session.toProps());
    },
  );
  router.post(
    "/event-sessions/:eventSessionId/cancel",
    input.permission(PERMISSION_KEY.BOOKING_EVENT_SESSION_CANCEL),
    validate({ params: eventSessionParamsSchema, body: eventSessionVersionSchema }),
    async (request, response) => {
      const { eventSessionId } = eventSessionParamsSchema.parse(request.params);
      const { version } = eventSessionVersionSchema.parse(request.body);
      const session = await useCases.cancel({
        ...readTenantCaller(),
        eventSessionId: asId<EventSessionId>(eventSessionId),
        version,
      });
      sendData(response, session.toProps());
    },
  );
}
