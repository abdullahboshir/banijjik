import { eventHandlerRegistry } from "../kernel/events/index.js";
import { runEventHandler } from "../kernel/events/handler-runner.js";
import type { ModuleEffectiveness } from "../kernel/events/module-effectiveness.js";
import type { OutboxEventDocument } from "../kernel/events/outbox-event.schema.js";
import { outboxModel } from "./event-fixtures.js";

const EFFECTIVE: ModuleEffectiveness = { isEffective: async () => true };

/**
 * Runs every registered handler of the organization's events in outbox order, as the worker would,
 * through the real exactly-once runner. A second call is a replay: each handler must then do nothing.
 */
export async function processOrganizationOutbox(organizationId: string): Promise<void> {
  const events = await outboxModel()
    .find({ organizationId })
    .sort({ occurredAt: 1, streamSequence: 1 })
    .lean<OutboxEventDocument[]>();
  for (const event of events) {
    for (const handler of eventHandlerRegistry.handlersFor(event)) {
      await runEventHandler(
        {
          eventId: event.eventId,
          handlerKey: handler.handlerKey,
          type: event.type,
          organizationId,
        },
        eventHandlerRegistry,
        EFFECTIVE,
      );
    }
  }
}
