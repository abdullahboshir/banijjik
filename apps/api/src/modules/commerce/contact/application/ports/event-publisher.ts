import type { EventPayloadMap } from "@banijjik/contracts";
import type { ContactEventType } from "@banijjik/contracts/contact";

/**
 * Publishes a contact domain event into the outbox. It must be called inside the unit of work that
 * makes the change (the kernel refuses otherwise), so the event exists exactly when the change does.
 */
export interface EventPublisher {
  publish<Type extends ContactEventType>(type: Type, payload: EventPayloadMap[Type]): Promise<void>;
}
