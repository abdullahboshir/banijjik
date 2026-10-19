import {
  ERROR_CODE,
  type EventEnvelope,
  type EventPayloadMap,
  type EventType,
  type ModuleKey,
} from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";

export type HandlerOrdering = "ORDERED" | "UNORDERED";

export interface EventHandler<Type extends EventType = EventType> {
  /** `<module>.<purpose>`, unique across the application. It names the job, so it has no ":" (BullMQ job ids). */
  readonly handlerKey: string;
  /** The module that owns the handler: it runs for an organization only while this module is effective there. */
  readonly moduleKey: ModuleKey;
  readonly eventType: Type;
  /**
   * Extra event types the same handler consumes. Needed when one ORDERED handler follows a shared
   * per-organization stream that carries several types (card 3.8c: paymentAccount, bookingAccount).
   */
  readonly alsoHandles?: readonly EventType[];
  /**
   * ORDERED: events with an `orderingKey` reach the handler in stream order, each exactly once (ADR-115).
   * UNORDERED: any order, as before. Every handler states it, so nobody gets ordering by accident.
   */
  readonly ordering: HandlerOrdering;
  handle(envelope: EventEnvelope<EventPayloadMap[Type]>): Promise<void>;
}

const HANDLER_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;

function registryError(messageKey: string, handlerKey: string): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey, details: { handlerKey } });
}

/**
 * The handlers of domain events. Modules register at startup; the worker seals the registry
 * before it starts, so the set of handlers cannot change while events are flowing (the same
 * pattern as the model registry).
 */
export class EventHandlerRegistry {
  private readonly handlers = new Map<string, EventHandler>();
  private isSealed = false;

  register<Type extends EventType>(handler: EventHandler<Type>): void {
    if (this.isSealed) {
      throw registryError("errors.event_handler_registry_sealed", handler.handlerKey);
    }
    if (!HANDLER_KEY_PATTERN.test(handler.handlerKey)) {
      throw registryError("errors.invalid_event_handler_key", handler.handlerKey);
    }
    if (this.handlers.has(handler.handlerKey)) {
      throw registryError("errors.duplicate_event_handler", handler.handlerKey);
    }
    this.handlers.set(handler.handlerKey, handler);
  }

  seal(): void {
    this.isSealed = true;
  }

  find(handlerKey: string): EventHandler | undefined {
    return this.handlers.get(handlerKey);
  }

  handlersFor(eventType: string): readonly EventHandler[] {
    return [...this.handlers.values()].filter(
      (handler) =>
        handler.eventType === eventType ||
        (handler.alsoHandles?.includes(eventType as EventType) ?? false),
    );
  }
}

/** The application's registry. Tests build their own instances. */
export const eventHandlerRegistry = new EventHandlerRegistry();

/** Modules call this at startup, before the worker starts. */
export function registerEventHandler<Type extends EventType>(handler: EventHandler<Type>): void {
  eventHandlerRegistry.register(handler);
}
