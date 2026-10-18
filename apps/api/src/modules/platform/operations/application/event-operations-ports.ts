import type { PlatformAuditRecorder } from "../../../../kernel/audit/index.js";
import type {
  DeadLetterAction,
  DeadLetterPage,
  DeadOutboxPage,
  OutboxReplay,
  PageQuery,
} from "../../../../kernel/events/index.js";

/** The kernel's dead-letter functions, as the use cases see them (the real ones are wired in index.ts). */
export interface EventOperations {
  listDeadLetters(input: {
    readonly status?: string | undefined;
    readonly page: PageQuery;
  }): Promise<DeadLetterPage>;
  listDeadOutboxEvents(page: PageQuery): Promise<DeadOutboxPage>;
  replayDeadLetter(input: {
    readonly eventDeadLetterId: string;
    readonly operatorId: string;
  }): Promise<DeadLetterAction>;
  skipDeadLetter(input: {
    readonly eventDeadLetterId: string;
    readonly operatorId: string;
    readonly reason: string;
  }): Promise<DeadLetterAction>;
  replayDeadOutboxEvent(eventId: string): Promise<OutboxReplay>;
}

export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface EventOperationsDependencies {
  readonly operations: EventOperations;
  readonly unitOfWork: UnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
}
