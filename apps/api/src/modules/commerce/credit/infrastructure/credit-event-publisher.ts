import type { EventPayloadMap, EventType } from "@banijjik/contracts";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
import type { CreditDependencies } from "../application/ports/credit-dependencies.js";

/** One adapter for the routes and the expiry job, so neither needs a cast. */
export function buildCreditEventPublisher(): CreditDependencies["events"] {
  return {
    publish: async (type, payload, options) => {
      // The port is typed loosely so the application layer stays free of the event catalogue;
      // the kernel publisher validates the type at runtime.
      await kernelEventPublisher.publish(
        type as EventType,
        payload as EventPayloadMap[EventType],
        options,
      );
    },
  };
}
