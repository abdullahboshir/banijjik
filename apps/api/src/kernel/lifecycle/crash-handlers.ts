import { reportError } from "../observability/report-error.js";

export interface RegisterCrashHandlersOptions {
  /** Injected so tests do not end the test runner. */
  readonly exit?: (code: number) => void;
}

const CRASH_EVENTS = ["unhandledRejection", "uncaughtException"] as const;

/**
 * A failure outside any request (a stray rejection, a throw in a timer) would otherwise skip the
 * logger and the central error capture. Report it, then exit 1: the process state is unknown, so
 * the supervisor restarts it. Returns a function that removes the listeners.
 */
export function registerCrashHandlers(options: RegisterCrashHandlersOptions = {}): () => void {
  const { exit = process.exit } = options;
  const handleCrash = (error: unknown): void => {
    reportError(error, {});
    exit(1);
  };
  for (const event of CRASH_EVENTS) process.on(event, handleCrash);
  return () => {
    for (const event of CRASH_EVENTS) process.off(event, handleCrash);
  };
}
