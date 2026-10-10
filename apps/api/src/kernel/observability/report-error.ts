import { getLogger } from "../logger/index.js";
import { toLoggableError } from "./to-loggable-error.js";

export interface ErrorReportContext {
  readonly requestId?: string;
  readonly method?: string;
  readonly path?: string;
  /** Set when a queue handler gives up (card 1.5b). */
  readonly eventId?: string;
  readonly handlerKey?: string;
  readonly eventType?: string;
  readonly attempts?: number;
}

/**
 * The single place unexpected errors are captured. It only logs for now; the Sentry
 * transport is added here in card 6.5 so no caller changes. Errors are logged through
 * toLoggableError so driver errors cannot leak the user data inside them.
 */
export function reportError(error: unknown, context: ErrorReportContext): void {
  getLogger().error({ err: toLoggableError(error), ...context }, "unhandled error");
}
