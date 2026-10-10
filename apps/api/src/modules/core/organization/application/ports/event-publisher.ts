import type { EventPayloadMap, OrganizationEventType } from "@banijjik/contracts";

/**
 * Publishes an organization domain event into the outbox. It must be called inside the unit of
 * work that makes the change (the kernel refuses otherwise), so the event exists exactly when the
 * change does.
 */
export interface EventPublisher {
  publish<Type extends OrganizationEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
  ): Promise<void>;
}
