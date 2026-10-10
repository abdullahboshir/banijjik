import { registerEventDeadLetterModel } from "./dead-letter.schema.js";
import { registerOutboxEventModel } from "./outbox-event.schema.js";
import { registerProcessedEventModel } from "./processed-event.schema.js";

/** Startup calls this once, next to registerSequenceModel(); both roles need the outbox. */
export function registerEventModels(): void {
  registerOutboxEventModel();
  registerProcessedEventModel();
  registerEventDeadLetterModel();
}
