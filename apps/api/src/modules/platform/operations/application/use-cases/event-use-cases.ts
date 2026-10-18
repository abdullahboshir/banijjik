import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type PlatformDeadLetter,
} from "@banijjik/contracts";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import type {
  DeadLetterAction,
  DeadLetterPage,
  DeadOutboxPage,
} from "../../../../../kernel/events/index.js";
import {
  deadLetterNotFailed,
  eventRecordNotFound,
  outboxEventNotDead,
  streamNotAtEvent,
} from "../../domain/errors.js";
import type { EventOperationsDependencies } from "../event-operations-ports.js";

export interface PageInput {
  readonly page: number;
  readonly limit: number;
}

export class ListDeadLettersUseCase {
  constructor(private readonly dependencies: EventOperationsDependencies) {}

  execute(input: PageInput & { readonly status?: string | undefined }): Promise<DeadLetterPage> {
    return this.dependencies.operations.listDeadLetters({
      status: input.status,
      page: { page: input.page, limit: input.limit },
    });
  }
}

export class ListDeadOutboxEventsUseCase {
  constructor(private readonly dependencies: EventOperationsDependencies) {}

  execute(input: PageInput): Promise<DeadOutboxPage> {
    return this.dependencies.operations.listDeadOutboxEvents(input);
  }
}

function doneOrThrow(result: DeadLetterAction): {
  before: PlatformDeadLetter;
  after: PlatformDeadLetter;
} {
  if (result.kind === "NOT_FOUND") throw eventRecordNotFound();
  if (result.kind === "NOT_FAILED") throw deadLetterNotFailed();
  if (result.kind === "STREAM_NOT_AT_EVENT") throw streamNotAtEvent();
  return result;
}

export interface ReplayDeadLetterInput {
  readonly eventDeadLetterId: string;
  readonly operatorId: string;
}

/** Queues a failed handler job again with fresh attempts (the worker does the queueing); audited. */
export class ReplayDeadLetterUseCase {
  constructor(private readonly dependencies: EventOperationsDependencies) {}

  execute(input: ReplayDeadLetterInput): Promise<PlatformDeadLetter> {
    const { operations, unitOfWork, platformAudit } = this.dependencies;
    return unitOfWork.run(async () => {
      const { before, after } = doneOrThrow(await operations.replayDeadLetter(input));
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.EVENT_DEAD_LETTER_REPLAYED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.event_dead_letter,
        targetId: after.eventDeadLetterId,
        ...(after.organizationId === null ? {} : { organizationId: after.organizationId }),
        changes: diffAuditFields({ status: before.status }, { status: after.status }),
        reason: `replay of ${after.handlerKey}`,
      });
      return after;
    });
  }
}

export interface SkipDeadLetterInput extends ReplayDeadLetterInput {
  readonly reason: string;
}

/**
 * Gives up on a failed handler job. The handler's effect never happened and must be fixed by hand; for
 * an ORDERED handler the stream continues after it. A reason is required and audited.
 */
export class SkipDeadLetterUseCase {
  constructor(private readonly dependencies: EventOperationsDependencies) {}

  execute(input: SkipDeadLetterInput): Promise<PlatformDeadLetter> {
    const { operations, unitOfWork, platformAudit } = this.dependencies;
    return unitOfWork.run(async () => {
      const { before, after } = doneOrThrow(await operations.skipDeadLetter(input));
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.EVENT_DEAD_LETTER_SKIPPED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.event_dead_letter,
        targetId: after.eventDeadLetterId,
        ...(after.organizationId === null ? {} : { organizationId: after.organizationId }),
        changes: diffAuditFields({ status: before.status }, { status: after.status }),
        reason: input.reason,
      });
      return after;
    });
  }
}

/** Puts a DEAD outbox event back to PENDING so the dispatcher tries it again; audited. */
export class ReplayDeadOutboxEventUseCase {
  constructor(private readonly dependencies: EventOperationsDependencies) {}

  execute(eventId: string): Promise<{ eventId: string }> {
    const { operations, unitOfWork, platformAudit } = this.dependencies;
    return unitOfWork.run(async () => {
      const result = await operations.replayDeadOutboxEvent(eventId);
      if (result.kind === "NOT_FOUND") throw eventRecordNotFound();
      if (result.kind === "NOT_DEAD") throw outboxEventNotDead();
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.OUTBOX_EVENT_REPLAYED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.outbox_event,
        targetId: eventId,
        changes: diffAuditFields(
          { status: "DEAD", dispatchAttempts: result.dispatchAttempts },
          { status: "PENDING", dispatchAttempts: 0 },
        ),
        reason: `replay of ${result.eventType}`,
      });
      return { eventId };
    });
  }
}
