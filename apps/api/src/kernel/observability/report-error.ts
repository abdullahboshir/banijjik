import { getLogger } from "../logger/index.js";

export interface ErrorReportContext {
  readonly requestId?: string;
  readonly method?: string;
  readonly path?: string;
}

/**
 * The single place unexpected errors are captured. It only logs for now; the Sentry
 * transport is added here in card 6.5 so no caller changes.
 */
export function reportError(error: unknown, context: ErrorReportContext): void {
  getLogger().error({ err: error, ...context }, "unhandled error");
}
