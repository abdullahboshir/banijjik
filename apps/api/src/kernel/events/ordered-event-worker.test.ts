import { EVENT_TYPE, MODULE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import {
  outboxModel,
  publishTestEvent,
  type PublishedTestEvent,
} from "../../test-support/event-fixtures.js";
import { MutableClock } from "../../test-support/mutable-clock.js";
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
import { initializeModels, models, withTransaction } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { replayDeadLetter, skipDeadLetter } from "./dead-letter-admin.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "./dead-letter.schema.js";
import { EventHandlerRegistry } from "./event-handler-registry.js";
import { buildEventJobId, EVENT_QUEUE_NAME, type EventJobData } from "./event-job.js";
import { startEventProcessing, type EventProcessing } from "./event-processing.js";
import { BullMqEventJobQueue, EVENT_JOB_ATTEMPTS } from "./event-queue.js";
import {
  EVENT_STREAM_MODEL_NAME,
  EVENT_STREAM_POSITION_MODEL_NAME,
} from "./event-stream.schema.js";
import { PROCESSED_EVENT_MODEL_NAME } from "./processed-event.schema.js";
import { registerEventModels } from "./register-event-models.js";

registerEventModels();

let connections: DatabaseConnections;

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
    PROCESSED_EVENT_MODEL_NAME,
    EVENT_DEAD_LETTER_MODEL_NAME,
    EVENT_STREAM_MODEL_NAME,
    EVENT_STREAM_POSITION_MODEL_NAME,
  ]) {
    await models({}).get(name).deleteMany({});
  }
});

const HANDLER_KEY = "ledger.post";
const SHORT_DELAY_MS = 20;
const WAITS_BEFORE_THE_LATE_EVENT = 3;

/** Stream sequence handled, in order of handling, and how often each sequence was tried. */
interface Ledger {
  readonly registry: EventHandlerRegistry;
  readonly handled: number[];
  readonly tries: Map<number, number>;
}

function orderedLedger(failingSequences: readonly number[] = []): Ledger {
  const handled: number[] = [];
  const tries = new Map<number, number>();
  const registry = new EventHandlerRegistry();
  registry.register({
    handlerKey: HANDLER_KEY,
    moduleKey: MODULE_KEY.IAM,
    eventType: EVENT_TYPE.USER_REGISTERED,
    ordering: "ORDERED",
    streamPrefixes: ["order:"],
    handle: async (envelope) => {
      const row = await outboxModel().findOne({ eventId: envelope.eventId }).lean();
      const sequence = row?.streamSequence ?? 0;
      tries.set(sequence, (tries.get(sequence) ?? 0) + 1);
      if (failingSequences.includes(sequence)) throw new Error(`failed on ${sequence}`);
      handled.push(sequence);
    },
  });
  return { registry, handled, tries };
}

function jobOf(event: PublishedTestEvent): EventJobData {
  return {
    eventId: event.eventId,
    handlerKey: HANDLER_KEY,
    type: event.type,
    organizationId: event.organizationId,
  };
}

/**
 * Events of one record, published in order. They are marked dispatched at once, so the dispatcher
 * leaves them alone and the test decides in which order their jobs reach the queue.
 */
async function publishPair(): Promise<{ first: PublishedTestEvent; second: PublishedTestEvent }> {
  const organizationId = newId();
  const orderingKey = `order:${newId()}`;
  const first = await publishTestEvent(organizationId, orderingKey);
  const second = await publishTestEvent(organizationId, orderingKey);
  await outboxModel().updateMany({}, { $set: { status: "DISPATCHED", dispatchedAt: new Date() } });
  return { first, second };
}

async function publishOne(): Promise<PublishedTestEvent> {
  const event = await publishTestEvent(newId(), `order:${newId()}`);
  await outboxModel().updateMany({}, { $set: { status: "DISPATCHED", dispatchedAt: new Date() } });
  return event;
}

describeWithRedis("ordered event handlers on the worker", (redisUrl) => {
  let scope: RedisTestScope;
  let processing: EventProcessing | undefined;
  let queue: Queue<EventJobData> | undefined;

  beforeEach(() => {
    scope = createRedisTestScope(redisUrl);
  });

  afterEach(async () => {
    if (queue !== undefined) await queue.close();
    queue = undefined;
    if (processing !== undefined) {
      for (const task of processing.shutdownTasks) await task.run();
      processing = undefined;
    }
    await scope.dispose();
  });

  function start(registry: EventHandlerRegistry): BullMqEventJobQueue {
    processing = startEventProcessing({
      redis: scope.client,
      registry,
      effectiveness: { isEffective: async () => true },
      clock: new MutableClock(new Date()),
      pollIntervalMs: 50,
      queuePrefix: scope.prefix,
      retryBaseDelayMs: SHORT_DELAY_MS,
      streamWaitBaseDelayMs: SHORT_DELAY_MS,
    });
    queue = new Queue<EventJobData>(EVENT_QUEUE_NAME, {
      connection: scope.client,
      prefix: scope.prefix,
    });
    return new BullMqEventJobQueue({ queue, retryBaseDelayMs: SHORT_DELAY_MS });
  }

  async function pickups(event: PublishedTestEvent): Promise<number> {
    const job = await queue?.getJob(buildEventJobId(event.eventId, HANDLER_KEY));
    return job?.attemptsStarted ?? 0;
  }

  async function deadLetters(): Promise<EventDeadLetterDocument[]> {
    return models({}).get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME).find().lean();
  }

  it("handles an event that was delivered before its predecessor only after the predecessor, without a failure", async () => {
    const { first, second } = await publishPair();
    const ledger = orderedLedger();
    const jobs = start(ledger.registry);

    await jobs.enqueue(jobOf(second));
    await waitFor("the early event to wait", async () =>
      (await pickups(second)) >= 2 ? true : undefined,
    );
    await jobs.enqueue(jobOf(first));
    await waitFor("both events to be handled", async () =>
      ledger.handled.length === 2 ? true : undefined,
    );

    expect(ledger.handled).toEqual([1, 2]);
    expect(await deadLetters()).toHaveLength(0);
  });

  it("does not spend attempts while an event waits: after three waits it still gets all its attempts before it is dead-lettered", async () => {
    const { first, second } = await publishPair();
    const ledger = orderedLedger([2]);
    const jobs = start(ledger.registry);

    await jobs.enqueue(jobOf(second));
    await waitFor("three waits", async () =>
      (await pickups(second)) > WAITS_BEFORE_THE_LATE_EVENT ? true : undefined,
    );
    const deadLettersWhileWaiting = await deadLetters();
    await jobs.enqueue(jobOf(first));
    const [deadLetter] = await waitFor("the dead letter", async () => {
      const rows = await deadLetters();
      return rows.length > 0 ? rows : undefined;
    });

    expect(deadLettersWhileWaiting).toHaveLength(0);
    expect(ledger.tries.get(2)).toBe(EVENT_JOB_ATTEMPTS);
    expect(deadLetter).toMatchObject({
      eventId: second.eventId,
      handlerKey: HANDLER_KEY,
      attempts: EVENT_JOB_ATTEMPTS,
      status: "FAILED",
      streamSequence: 2,
    });
    expect(deadLetter?.orderingKey).toMatch(/^order:/);
  });

  it("lets a stream that is waiting leave the other streams alone", async () => {
    const { second: waitingSecond } = await publishPair();
    const otherFirst = await publishOne();
    const ledger = orderedLedger();
    const jobs = start(ledger.registry);

    await jobs.enqueue(jobOf(waitingSecond));
    await jobs.enqueue(jobOf(otherFirst));
    await waitFor("the other stream to be handled", async () =>
      ledger.handled.length === 1 ? true : undefined,
    );

    expect(ledger.handled).toEqual([1]);
    expect(ledger.tries.get(2)).toBeUndefined();
  });

  it("keeps the stream waiting behind a dead-lettered event, on purpose", async () => {
    const { first, second } = await publishPair();
    const ledger = orderedLedger([1]);
    const jobs = start(ledger.registry);

    await jobs.enqueue(jobOf(first));
    await waitFor("the first event to be dead-lettered", async () =>
      (await deadLetters()).length === 1 ? true : undefined,
    );
    await jobs.enqueue(jobOf(second));
    await waitFor("the second event to wait", async () =>
      (await pickups(second)) >= 3 ? true : undefined,
    );

    expect(ledger.handled).toEqual([]);
    expect(ledger.tries.get(2)).toBeUndefined();
    expect(await deadLetters()).toHaveLength(1);
  });
});

describeWithRedis("replay and skip of a dead-lettered event on the worker", (redisUrl) => {
  let scope: RedisTestScope;
  let processing: EventProcessing | undefined;
  let queue: Queue<EventJobData> | undefined;

  beforeEach(() => {
    scope = createRedisTestScope(redisUrl);
  });

  afterEach(async () => {
    if (queue !== undefined) await queue.close();
    queue = undefined;
    if (processing !== undefined) {
      for (const task of processing.shutdownTasks) await task.run();
      processing = undefined;
    }
    await scope.dispose();
  });

  function start(registry: EventHandlerRegistry): BullMqEventJobQueue {
    processing = startEventProcessing({
      redis: scope.client,
      registry,
      effectiveness: { isEffective: async () => true },
      clock: new MutableClock(new Date()),
      pollIntervalMs: 50,
      queuePrefix: scope.prefix,
      retryBaseDelayMs: SHORT_DELAY_MS,
      streamWaitBaseDelayMs: SHORT_DELAY_MS,
    });
    queue = new Queue<EventJobData>(EVENT_QUEUE_NAME, {
      connection: scope.client,
      prefix: scope.prefix,
    });
    return new BullMqEventJobQueue({ queue, retryBaseDelayMs: SHORT_DELAY_MS });
  }

  async function failedLetterOf(event: PublishedTestEvent): Promise<EventDeadLetterDocument> {
    return waitFor("the dead letter", async () => {
      const row = await models({})
        .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
        .findOne({ eventId: event.eventId, status: "FAILED" })
        .lean<EventDeadLetterDocument>();
      return row ?? undefined;
    });
  }

  async function waitForJobState(event: PublishedTestEvent, state: "delayed" | "completed") {
    return waitFor(`event ${event.eventId} to be ${state}`, async () => {
      const job = await queue?.getJob(buildEventJobId(event.eventId, HANDLER_KEY));
      return (await job?.getState()) === state ? job : undefined;
    });
  }

  it("runs a replayed event again with fresh attempts, and the stream continues behind it", async () => {
    const { first, second } = await publishPair();
    let isBroken = true;
    const ledger = orderedLedger();
    const original = ledger.registry.find(HANDLER_KEY);
    const registry = new EventHandlerRegistry();
    registry.register({
      handlerKey: HANDLER_KEY,
      moduleKey: MODULE_KEY.IAM,
      eventType: EVENT_TYPE.USER_REGISTERED,
      ordering: "ORDERED",
      streamPrefixes: ["order:"],
      handle: async (envelope) => {
        const row = await outboxModel().findOne({ eventId: envelope.eventId }).lean();
        if (row?.streamSequence === 1 && isBroken) throw new Error("not yet fixed");
        await original?.handle(envelope);
      },
    });
    const jobs = start(registry);
    await jobs.enqueue(jobOf(first));
    const letter = await failedLetterOf(first);
    await jobs.enqueue(jobOf(second));

    isBroken = false;
    const requested = await withTransaction(() =>
      replayDeadLetter({ eventDeadLetterId: letter.eventDeadLetterId, operatorId: newId() }),
    );
    await waitFor("both events to be handled in order", async () =>
      ledger.handled.length === 2 ? true : undefined,
    );

    expect(ledger.handled).toEqual([1, 2]);
    const row = await models({})
      .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
      .findOne({ eventDeadLetterId: letter.eventDeadLetterId })
      .lean<EventDeadLetterDocument>();
    expect(row?.status).toBe("REPLAYED");
    expect(requested.kind === "DONE" && requested.after.status).toBe("REPLAY_REQUESTED");
    expect(row?.requeuedAt).toBeInstanceOf(Date);
  });

  it("lets the stream continue after a skip, and never runs the skipped event", async () => {
    const { first, second } = await publishPair();
    const ledger = orderedLedger([1]);
    const jobs = start(ledger.registry);
    await jobs.enqueue(jobOf(first));
    const letter = await failedLetterOf(first);
    await jobs.enqueue(jobOf(second));

    const waitingJob = await waitForJobState(second, "delayed");
    if (processing === undefined) throw new Error("event processing was not started");
    // Freeze the queue at a known boundary so back-off cannot grow while the skip commits.
    await processing.worker.pause();
    expect(ledger.handled).toEqual([]);
    const skipped = await withTransaction(() =>
      skipDeadLetter({
        eventDeadLetterId: letter.eventDeadLetterId,
        operatorId: newId(),
        reason: "posted by hand",
      }),
    );
    expect(skipped.kind === "DONE" && skipped.after.status).toBe("SKIPPED");
    // The behaviour under test is stream progression, not BullMQ's real-time delayed-job timer.
    if (await waitingJob.isDelayed()) await waitingJob.promote();
    await processing.worker.resume();
    await waitForJobState(second, "completed");

    const skippedJob = await queue?.getJob(buildEventJobId(first.eventId, HANDLER_KEY));
    if (skippedJob === undefined) throw new Error("the skipped job was not retained");
    await skippedJob.retry();
    await waitForJobState(first, "completed");

    expect(ledger.handled).toEqual([2]);
    expect(ledger.tries.get(1)).toBe(EVENT_JOB_ATTEMPTS);
  });
});
