import {
  ERROR_CODE,
  type EventEnvelope,
  type EventPayloadMap,
  type EventType,
  type ModuleKey,
} from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";

export type HandlerOrdering = "ORDERED" | "UNORDERED";

interface EventHandlerBase<Type extends EventType> {
  /** `<module>.<purpose>`, unique across the application. It names the job, so it has no ":" (BullMQ job ids). */
  readonly handlerKey: string;
  /** The module that owns the handler: it runs for an organization only while this module is effective there. */
  readonly moduleKey: ModuleKey;
  readonly eventType: Type;
  /**
   * Extra event types the same handler consumes. Needed when one ORDERED handler follows a shared
   * stream that carries several handled types (card 3.8c: paymentAccount, expenseAccount).
   */
  readonly alsoHandles?: readonly EventType[];
  handle(envelope: EventEnvelope<EventPayloadMap[Type]>): Promise<void>;
}

/** An ORDERED handler receives every event of its streams, handles its types and steps over the rest. */
export type EventHandler<Type extends EventType = EventType> =
  | (EventHandlerBase<Type> & {
      readonly ordering: "UNORDERED";
      readonly streamPrefixes?: never;
    })
  | (EventHandlerBase<Type> & {
      readonly ordering: "ORDERED";
      /** Every event whose orderingKey starts with one of these reaches the handler (ADR-136). */
      readonly streamPrefixes: readonly [string, ...string[]];
    });

export function handlesType(handler: EventHandler, eventType: string): boolean {
  return (
    handler.eventType === eventType ||
    (handler.alsoHandles?.some((type) => type === eventType) ?? false)
  );
}

export function followsStream(handler: EventHandler, orderingKey: string | null): boolean {
  return (
    handler.ordering === "ORDERED" &&
    orderingKey !== null &&
    handler.streamPrefixes.some((prefix) => orderingKey.startsWith(prefix))
  );
}

function validateStreams(handler: EventHandler): void {
  if (handler.ordering !== "ORDERED") return;
  const prefixes = handler.streamPrefixes;
  if (
    prefixes.length === 0 ||
    prefixes.some(
      (prefix, index) =>
        !/^[a-z][a-zA-Z]*:$/.test(prefix) ||
        prefixes.some((other, otherIndex) => index !== otherIndex && prefix.startsWith(other)),
    )
  ) {
    throw registryError("errors.event_handler_invalid_stream", handler.handlerKey);
  }
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
    validateStreams(handler);
    this.handlers.set(handler.handlerKey, handler);
  }

  seal(): void {
    this.isSealed = true;
  }

  find(handlerKey: string): EventHandler | undefined {
    return this.handlers.get(handlerKey);
  }

  handlersFor(event: {
    readonly type: string;
    readonly orderingKey: string | null;
  }): readonly EventHandler[] {
    return [...this.handlers.values()].filter(
      (handler) => handlesType(handler, event.type) || followsStream(handler, event.orderingKey),
    );
  }
}

/** The application's registry. Tests build their own instances. */
export const eventHandlerRegistry = new EventHandlerRegistry();

/** Modules call this at startup, before the worker starts. */
export function registerEventHandler<Type extends EventType>(handler: EventHandler<Type>): void {
  eventHandlerRegistry.register(handler);
}
