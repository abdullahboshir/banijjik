import type { Router } from "express";
import type { PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import {
  listDeadLetters,
  listDeadOutboxEvents,
  replayDeadLetter,
  replayDeadOutboxEvent,
  skipDeadLetter,
} from "../../../kernel/events/index.js";
import type { EventOperationsDependencies } from "./application/event-operations-ports.js";
import {
  ListDeadLettersUseCase,
  ListDeadOutboxEventsUseCase,
  ReplayDeadLetterUseCase,
  ReplayDeadOutboxEventUseCase,
  SkipDeadLetterUseCase,
} from "./application/use-cases/event-use-cases.js";
import { EventOperationsController } from "./presentation/event-operations.controller.js";
import { buildEventOperationsRouters } from "./presentation/event-operations.router.js";

export { operationsManifest } from "./module.manifest.js";

export interface OperationsRouterDependencies {
  readonly permission: PlatformPermissionMiddlewareFactory;
  readonly platformAudit: PlatformAuditRecorder;
}

/** The two routers of the failed-events screens, mounted by routes/platform.ts. */
export function buildOperationsRouters(dependencies: OperationsRouterDependencies): {
  deadLetters: Router;
  deadOutbox: Router;
} {
  const shared: EventOperationsDependencies = {
    operations: {
      listDeadLetters,
      listDeadOutboxEvents,
      replayDeadLetter,
      skipDeadLetter,
      replayDeadOutboxEvent,
    },
    unitOfWork: new MongoUnitOfWork(),
    platformAudit: dependencies.platformAudit,
  };
  const controller = new EventOperationsController({
    listDeadLetters: new ListDeadLettersUseCase(shared),
    listDeadOutboxEvents: new ListDeadOutboxEventsUseCase(shared),
    replayDeadLetter: new ReplayDeadLetterUseCase(shared),
    skipDeadLetter: new SkipDeadLetterUseCase(shared),
    replayDeadOutboxEvent: new ReplayDeadOutboxEventUseCase(shared),
  });
  return buildEventOperationsRouters(controller, dependencies.permission);
}
