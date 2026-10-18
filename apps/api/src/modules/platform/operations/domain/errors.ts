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
