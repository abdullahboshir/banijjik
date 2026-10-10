import type { EventPayloadMap, IamEventType } from "@banijjik/contracts";

/**
 * Publishes an iam domain event into the outbox. It must be called inside the unit of work that
 * makes the change (the kernel refuses otherwise), so the event exists exactly when the change does.
 */
export interface EventPublisher {
  publish<Type extends IamEventType>(type: Type, payload: EventPayloadMap[Type]): Promise<void>;
}
