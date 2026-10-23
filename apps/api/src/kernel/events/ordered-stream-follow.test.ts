import { EVENT_TYPE, MODULE_KEY, type EventType } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Queue, type Worker } from "bullmq";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { runWithRequestContext } from "../context/index.js";
import { initializeModels, models, withTransaction } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { outboxModel } from "../../test-support/event-fixtures.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import {
  createRedisTestScope,
  describeWithRedis,
  type RedisTestScope,
} from "../../test-support/test-redis.js";
import { waitFor } from "../../test-support/wait-for.js";
import { systemClock } from "../time/index.js";
import { EventHandlerRegistry } from "./event-handler-registry.js";
import { EVENT_DEAD_LETTER_MODEL_NAME } from "./dead-letter.schema.js";
import { buildEventJobId, EVENT_QUEUE_NAME, type EventJobData } from "./event-job.js";
import { BullMqEventJobQueue, EVENT_JOB_ATTEMPTS } from "./event-queue.js";
import {
  EVENT_STREAM_MODEL_NAME,
  EVENT_STREAM_POSITION_MODEL_NAME,
} from "./event-stream.schema.js";
import { createEventWorker } from "./event-worker.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";
import { PROCESSED_EVENT_MODEL_NAME } from "./processed-event.schema.js";
import { publishEvent } from "./publish-event.js";
import { registerEventModels } from "./register-event-models.js";

registerEventModels();
let connections: DatabaseConnections;
const HANDLER_KEY = "ledger.postBooking";
beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});
afterAll(async () => {
  await disposeTestDatabases(connections);
});
beforeEach(async () => {
  await outboxModel().deleteMany({});
  for (const name of [
    EVENT_STREAM_MODEL_NAME,
    EVENT_STREAM_POSITION_MODEL_NAME,
    PROCESSED_EVENT_MODEL_NAME,
    EVENT_DEAD_LETTER_MODEL_NAME,
  ]) {
    await models({}).get(name).deleteMany({});
  }
});

async function publishBookingStream(): Promise<EventJobData[]> {
  const organizationId = newId();
  const bookingId = newId();
  await runWithRequestContext({ requestId: newId(), organizationId }, async () => {
    for (const type of [
      EVENT_TYPE.BOOKING_REQUESTED,
      EVENT_TYPE.BOOKING_CONFIRMED,
      EVENT_TYPE.BOOKING_COMPLETED,
    ]) {
      await withTransaction(() =>
        publishEvent(type, { bookingId }, { orderingKey: `booking:${bookingId}` }),
      );
    }
  });
  const events = await outboxModel().find().sort({ streamSequence: 1 }).lean();
  return events.map((event) => ({
    eventId: event.eventId,
    handlerKey: HANDLER_KEY,
    type: event.type,
    organizationId,
  }));
}

async function position(): Promise<number> {
  const row = await models({})
    .get(EVENT_STREAM_POSITION_MODEL_NAME)
    .findOne({ handlerKey: HANDLER_KEY })
    .lean<{ lastSequence: number }>();
  return row?.lastSequence ?? 0;
}

describeWithRedis(
  "ordered handlers follow whole streams through the dispatcher and worker",
  (redisUrl) => {
    let scope: RedisTestScope;
    let queue: Queue<EventJobData>;
    let worker: Worker<EventJobData>;
    beforeEach(() => {
      scope = createRedisTestScope(redisUrl);
    });
    afterEach(async () => {
      await worker.close();
      await queue.close();
      await scope.dispose();
    });

    function start(prefix = "booking:", type: EventType = EVENT_TYPE.BOOKING_COMPLETED) {
      const handle = vi.fn(async () => undefined);
      const registry = new EventHandlerRegistry();
      registry.register({
        handlerKey: HANDLER_KEY,
        moduleKey: MODULE_KEY.ACCOUNTING,
        eventType: type,
        ordering: "ORDERED",
        streamPrefixes: [prefix],
        handle,
      });
      queue = new Queue<EventJobData>(EVENT_QUEUE_NAME, {
        connection: scope.client,
        prefix: scope.prefix,
      });
      worker = createEventWorker({
        connection: scope.client,
        registry,
        effectiveness: { isEffective: async () => true },
        prefix: scope.prefix,
        streamWaitBaseDelayMs: 20,
      });
      const jobs = new BullMqEventJobQueue({ queue, retryBaseDelayMs: 20 });
      const dispatcher = new OutboxDispatcher({ queue: jobs, registry, clock: systemClock });
      return { handle, jobs, dispatcher };
    }

    it("steps over booking requested and confirmed, handles completed once and ends at position 3 with nothing waiting", async () => {
      await publishBookingStream();
      const { handle, dispatcher } = start();
      expect(await dispatcher.dispatchBatch()).toBe(3);
      await waitFor("position 3", async () => ((await position()) === 3 ? true : undefined));
      await waitFor("all jobs complete", async () =>
        (await queue.getCompletedCount()) === 3 ? true : undefined,
      );
      expect(handle).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: EVENT_TYPE.BOOKING_COMPLETED }),
      );
      expect(await queue.getWaitingCount()).toBe(0);
      expect(await queue.getDelayedCount()).toBe(0);
      expect(await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments()).toBe(1);
    });

    it("waits when completed arrives first, steps over its predecessors and then ends at position 3", async () => {
      const events = await publishBookingStream();
      const first = events[0];
      const second = events[1];
      const third = events[2];
      if (!first || !second || !third) throw new Error("missing booking events");
      const { handle, jobs } = start();
      await jobs.enqueue(third);
      await waitFor("completed to wait", async () => {
        const job = await queue.getJob(buildEventJobId(third.eventId, HANDLER_KEY));
        return (job?.attemptsStarted ?? 0) >= 2 ? true : undefined;
      });
      expect(handle).not.toHaveBeenCalled();
      await jobs.enqueue(first);
      await jobs.enqueue(second);
      await waitFor("position 3", async () => ((await position()) === 3 ? true : undefined));
      expect(handle).toHaveBeenCalledTimes(1);
      expect(await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).countDocuments()).toBe(0);
    });

    it("dead-letters a handled type on the wrong stream with stream mismatch and never calls handle", async () => {
      const events = await publishBookingStream();
      const first = events[0];
      if (!first) throw new Error("missing booking event");
      const { handle, dispatcher } = start("order:", EVENT_TYPE.BOOKING_REQUESTED);
      await dispatcher.dispatchBatch();
      const job = await waitFor("wrong-stream job to fail", async () => {
        const row = await queue.getJob(buildEventJobId(first.eventId, HANDLER_KEY));
        return row && (await row.getState()) === "failed" ? row : undefined;
      });
      expect(job.failedReason).toContain("errors.event_handler_stream_mismatch");
      expect(job.attemptsMade).toBe(EVENT_JOB_ATTEMPTS);
      expect(handle).not.toHaveBeenCalled();
      expect(
        await models({})
          .get(EVENT_DEAD_LETTER_MODEL_NAME)
          .findOne({ eventId: first.eventId })
          .lean(),
      ).toMatchObject({
        attempts: EVENT_JOB_ATTEMPTS,
        status: "FAILED",
        orderingKey: expect.stringMatching(/^booking:/),
      });
      expect(await position()).toBe(0);
    });
  },
);
