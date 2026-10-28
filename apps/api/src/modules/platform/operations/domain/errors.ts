import { DomainRuleError, ERROR_CODE, PLATFORM_RULE_KEY } from "@banijjik/contracts";

/** No dead letter or outbox event with this id. */
export function eventRecordNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The dead letter was already replayed or skipped, so there is nothing left to do. */
export function deadLetterNotFailed(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.event_dead_letter_not_failed",
    details: { ruleKey: PLATFORM_RULE_KEY.EVENT_DEAD_LETTER_NOT_FAILED },
  });
}

/** Skipping would jump over earlier events of the stream that were never handled. */
export function streamNotAtEvent(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.event_stream_not_at_event",
    details: { ruleKey: PLATFORM_RULE_KEY.EVENT_STREAM_NOT_AT_EVENT },
  });
}

/** Only an outbox event that is DEAD can be replayed. */
export function outboxEventNotDead(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.outbox_event_not_dead",
    details: { ruleKey: PLATFORM_RULE_KEY.OUTBOX_EVENT_NOT_DEAD },
  });
}

/** The host name cannot be a claimable site host (plan 4.2 decision 2); the caller answers 400. */
export function invalidHostname(hostname: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "hostname", messageKey: "validation.invalid_value" }], hostname },
  });
}

/** A platform host or the SaaS zone apex: never claimable by a business. */
export function reservedHostname(hostname: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "hostname", messageKey: "validation.invalid_value" }], hostname },
  });
}

/** Another business (or another site domain) already holds this host. */
export class HostClaimTakenError extends DomainRuleError {
  constructor(hostname: string) {
    super({ code: ERROR_CODE.DUPLICATE, details: { field: "hostname", hostname } });
    this.name = "HostClaimTakenError";
  }
}

/** A removed host waits out its provider deletion before anyone may claim it again (plan 4.2 decision 8). */
export class HostClaimQuarantinedError extends DomainRuleError {
  constructor(hostname: string, quarantineUntil: Date) {
    super({
      code: ERROR_CODE.CONFLICT,
      details: { field: "hostname", hostname, quarantineUntil: quarantineUntil.toISOString() },
    });
    this.name = "HostClaimQuarantinedError";
  }
}

/** A late job of an older operation generation must not touch the current claim (plan 4.2 decision 6). */
export class HostClaimGenerationMismatchError extends DomainRuleError {
  constructor(hostname: string, operationGeneration: number) {
    super({
      code: ERROR_CODE.CONFLICT,
      details: { field: "hostname", hostname, operationGeneration },
    });
    this.name = "HostClaimGenerationMismatchError";
  }
}
