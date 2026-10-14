import type { CustomFieldEventType, EventPayloadMap } from "@banijjik/contracts";

/** Publishes a custom-field event into the outbox. It must run inside the unit of work (ADR-090). */
export interface CustomFieldEventPublisher {
  publish<Type extends CustomFieldEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
  ): Promise<void>;
}
