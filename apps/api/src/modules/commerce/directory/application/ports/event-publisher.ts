import type { EventPayloadMap } from "@banijjik/contracts";
import type { DirectoryEventType } from "@banijjik/contracts/directory";

/** Publishes a directory domain event into the outbox inside the same unit of work. */
export interface EventPublisher {
  publish<Type extends DirectoryEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
    options?: { readonly orderingKey?: string },
  ): Promise<void>;
}
