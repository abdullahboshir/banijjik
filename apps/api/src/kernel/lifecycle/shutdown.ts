import type { Logger } from "pino";

export interface ShutdownTask {
  readonly name: string;
  run(): Promise<void>;
}

export interface RegisterShutdownOptions {
  readonly logger: Logger;
  /** Run in order. Cards that add resources (database, queue) append their own task. */
  readonly tasks: readonly ShutdownTask[];
  readonly timeoutMs?: number;
  /** Called before the forced exit when tasks hang, e.g. HTTP server closeAllConnections(). */
  readonly onTimeout?: () => void;
  /** Injected so tests do not end the test runner. */
  readonly exit?: (code: number) => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const SIGNALS: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

async function runTasks(options: RegisterShutdownOptions): Promise<boolean> {
  let allSucceeded = true;
  for (const task of options.tasks) {
    try {
      await task.run();
    } catch (error) {
      allSucceeded = false;
      options.logger.error({ err: error, task: task.name }, "shutdown task failed");
    }
  }
  return allSucceeded;
}

/**
 * Runs the tasks once on the first SIGTERM/SIGINT. A second signal, or exceeding the timeout,
 * ends the process with exit code 1. Returns a function that removes the signal listeners.
 */
export function registerShutdown(options: RegisterShutdownOptions): () => void {
  const { logger, timeoutMs = DEFAULT_TIMEOUT_MS, onTimeout, exit = process.exit } = options;
  let isShuttingDown = false;
  let hasTimedOut = false;

  const finishShutdown = async (timer: NodeJS.Timeout): Promise<void> => {
    const allSucceeded = await runTasks(options);
    clearTimeout(timer);
    if (hasTimedOut) return;
    process.exitCode = allSucceeded ? 0 : 1;
    logger.info({ event: "shutdown.completed" }, "shutdown completed");
  };

  const handleSignal = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      logger.fatal({ event: "shutdown.forced", signal }, "second signal, forcing exit");
      exit(1);
      return;
    }
    isShuttingDown = true;
    logger.info({ event: "shutdown.started", signal }, "shutting down");
    const timer = setTimeout(() => {
      logger.fatal({ event: "shutdown.timeout", timeoutMs }, "shutdown timed out");
      hasTimedOut = true;
      onTimeout?.();
      process.exitCode = 1;
      exit(1);
    }, timeoutMs);
    timer.unref();
    void finishShutdown(timer);
  };

  for (const signal of SIGNALS) process.on(signal, handleSignal);
  return () => {
    for (const signal of SIGNALS) process.off(signal, handleSignal);
  };
}
