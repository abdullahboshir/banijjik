import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformDeadOutboxListQuerySchema,
  platformDeadOutboxParamsSchema,
  platformEventDeadLetterListQuerySchema,
  platformEventDeadLetterParamsSchema,
  platformEventSkipRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { EventOperationsController } from "./event-operations.controller.js";

/** `/platform/event-dead-letters` and `/platform/dead-outbox-events` (14-API.md section 7). */
export function buildEventOperationsRouters(
  controller: EventOperationsController,
  permission: PlatformPermissionMiddlewareFactory,
): { deadLetters: Router; deadOutbox: Router } {
  const read = permission(PLATFORM_PERMISSION_KEY.EVENTS_READ);
  const replay = permission(PLATFORM_PERMISSION_KEY.EVENTS_REPLAY);
  const deadLetters = Router();
  deadLetters.get(
    "/",
    read,
    validate({ query: platformEventDeadLetterListQuerySchema }),
    controller.listDead,
  );
  deadLetters.post(
    "/:eventDeadLetterId/replay",
    replay,
    validate({ params: platformEventDeadLetterParamsSchema }),
    controller.replay,
  );
  deadLetters.post(
    "/:eventDeadLetterId/skip",
    replay,
    validate({
      params: platformEventDeadLetterParamsSchema,
      body: platformEventSkipRequestSchema,
    }),
    controller.skip,
  );
  const deadOutbox = Router();
  deadOutbox.get(
    "/",
    read,
    validate({ query: platformDeadOutboxListQuerySchema }),
    controller.listOutbox,
  );
  deadOutbox.post(
    "/:eventId/replay",
    replay,
    validate({ params: platformDeadOutboxParamsSchema }),
    controller.replayOutbox,
  );
  return { deadLetters, deadOutbox };
}
