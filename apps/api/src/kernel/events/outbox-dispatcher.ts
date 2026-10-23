import { getLogger } from "../logger/index.js";
import { reportError } from "../observability/report-error.js";
import type { Clock } from "../time/index.js";
import type { EventHandlerRegistry } from "./event-handler-registry.js";
import type { EventJobQueue } from "./event-job.js";
import {
  claimNextEvent,
  markDead,
  markDispatched,
  MAX_DISPATCH_ATTEMPTS,
  scheduleRetry,
} from "./outbox-claims.js";
import type { OutboxEventDocument } from "./outbox-event.schema.js";

export const DEFAULT_POLL_INTERVAL_MS = 500;
export const DEFAULT_BATCH_SIZE = 50;

export interface OutboxDispatcherOptions {
  readonly queue: EventJobQueue;
  readonly registry: EventHandlerRegistry;
  readonly clock: Clock;
  readonly pollIntervalMs?: number;
  readonly batchSize?: number;
}

/**
 * Turns pending outbox events into queue jobs, one job per registered handler (ADR-090). It runs
 * in the worker process only. Claims are atomic, so several workers can run it side by side.
 */
export class OutboxDispatcher {
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private isRunning = false;
  private timer: NodeJS.Timeout | undefined;
  private currentTick: Promise<void> | undefined;

  constructor(private readonly options: OutboxDispatcherOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleTick(0);
  }

  /** Waits for the batch in progress, so no event is left half-dispatched by a shutdown. */
  async stop(): Promise<void> {
    this.isRunning = false;
    clearTimeout(this.timer);
    await this.currentTick;
  }

  /** Dispatches up to one batch of due events, one by one. Returns how many it handled. */
  async dispatchBatch(): Promise<number> {
    let handled = 0;
    while (handled < this.batchSize) {
      const event = await claimNextEvent(this.options.clock.now());
      if (event === null) break;
      await this.dispatchOne(event);
      handled += 1;
    }
    return handled;
  }

  private scheduleTick(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.currentTick = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    let nextDelayMs = this.pollIntervalMs;
    try {
      const handled = await this.dispatchBatch();
      // A full batch means more may be waiting: come back at once.
      if (handled >= this.batchSize) nextDelayMs = 0;
    } catch (error) {
      // The database was unreachable or failed: report it and try again on the next tick.
      reportError(error, {});
    }
    if (this.isRunning) this.scheduleTick(nextDelayMs);
  }

  private async dispatchOne(event: OutboxEventDocument): Promise<void> {
    const { registry, queue, clock } = this.options;
    try {
      for (const handler of registry.handlersFor(event)) {
        await queue.enqueue({
          eventId: event.eventId,
          handlerKey: handler.handlerKey,
          type: event.type,
          organizationId: event.organizationId,
        });
      }
      await markDispatched(event.eventId, clock.now());
    } catch (error) {
      await this.handleDispatchFailure(event, error);
    }
  }

  private async handleDispatchFailure(event: OutboxEventDocument, error: unknown): Promise<void> {
    const attempts = event.dispatchAttempts + 1;
    if (attempts >= MAX_DISPATCH_ATTEMPTS) {
      await markDead(event, error);
      reportError(error, { eventId: event.eventId, eventType: event.type, attempts });
      return;
    }
    getLogger().warn(
      { event: "outbox.dispatch_failed", eventId: event.eventId, attempts },
      "outbox event could not be dispatched, will retry",
    );
    await scheduleRetry(event, this.options.clock.now(), error);
  }
}
