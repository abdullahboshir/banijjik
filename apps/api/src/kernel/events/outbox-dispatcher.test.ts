import { EVENT_TYPE, MODULE_KEY, OUTBOX_STATUS } from "@banijjik/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { outboxModel, publishTestEvent } from "../../test-support/event-fixtures.js";
import { MutableClock } from "../../test-support/mutable-clock.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import type { LogCapture } from "../../test-support/log-capture.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { initializeModels } from "../db/index.js";
import { EventHandlerRegistry } from "./event-handler-registry.js";
import { buildEventJobId, type EventJobData, type EventJobQueue } from "./event-job.js";
import { dispatchBackoffMs } from "./outbox-claims.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";
import { registerEventModels } from "./register-event-models.js";

registerEventModels();

let connections: DatabaseConnections;
let logs: LogCapture;

beforeAll(async () => {
  logs = installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

beforeEach(async () => {
  await outboxModel().deleteMany({});
});

class RecordingQueue implements EventJobQueue {
  readonly jobs: EventJobData[] = [];
  async enqueue(job: EventJobData): Promise<void> {
    this.jobs.push(job);
  }
}

class FailingQueue implements EventJobQueue {
  async enqueue(): Promise<void> {
    throw Object.assign(new Error("connect refused"), { code: "ECONNREFUSED" });
  }
}

function registryWith(...handlerKeys: string[]): EventHandlerRegistry {
  const registry = new EventHandlerRegistry();
  for (const handlerKey of handlerKeys) {
    registry.register({
      handlerKey,
      moduleKey: MODULE_KEY.IAM,
      eventType: EVENT_TYPE.USER_REGISTERED,
      ordering: "UNORDERED",
      handle: async () => undefined,
    });
  }
  return registry;
}

function aDispatcher(
  queue: EventJobQueue,
  registry: EventHandlerRegistry,
  clock = new MutableClock(new Date()),
): OutboxDispatcher {
  return new OutboxDispatcher({ queue, registry, clock });
}

describe("OutboxDispatcher", () => {
  it("adds one job per registered handler and marks the event dispatched", async () => {
    const event = await publishTestEvent();
    const queue = new RecordingQueue();
    const dispatcher = aDispatcher(queue, registryWith("audit.userRegistered", "mail.welcome"));

    const handled = await dispatcher.dispatchBatch();

    expect(handled).toBe(1);
    expect(queue.jobs.map((job) => job.handlerKey)).toEqual([
      "audit.userRegistered",
      "mail.welcome",
    ]);
    expect(queue.jobs[0]).toMatchObject({ eventId: event.eventId, type: "iam.user.registered" });
    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row?.status).toBe(OUTBOX_STATUS.DISPATCHED);
    expect(row?.dispatchedAt).toBeInstanceOf(Date);
  });

  it("marks an event with no handler dispatched without adding a job", async () => {
    const event = await publishTestEvent();
    const queue = new RecordingQueue();

    await aDispatcher(queue, registryWith()).dispatchBatch();

    expect(queue.jobs).toEqual([]);
    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row?.status).toBe(OUTBOX_STATUS.DISPATCHED);
  });

  it("never claims an event twice when two dispatchers run in parallel", async () => {
    for (let count = 0; count < 12; count += 1) await publishTestEvent();
    const queue = new RecordingQueue();
    const registry = registryWith("audit.userRegistered");

    await Promise.all([
      aDispatcher(queue, registry).dispatchBatch(),
      aDispatcher(queue, registry).dispatchBatch(),
    ]);

    const jobIds = queue.jobs.map((job) => buildEventJobId(job.eventId, job.handlerKey));
    expect(jobIds).toHaveLength(12);
    expect(new Set(jobIds).size).toBe(12);
  });

  it("keeps the event pending with attempts 1 and a retry in 5 seconds when the queue is unavailable", async () => {
    const event = await publishTestEvent();
    const clock = new MutableClock(new Date());
    const dispatcher = aDispatcher(new FailingQueue(), registryWith("audit.userRegistered"), clock);

    await dispatcher.dispatchBatch();

    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row).toMatchObject({
      status: OUTBOX_STATUS.PENDING,
      dispatchAttempts: 1,
      lastError: "Error ECONNREFUSED",
      lockedUntil: null,
    });
    expect(row?.nextAttemptAt.getTime()).toBe(clock.now().getTime() + 5000);
  });

  it("does not retry before the backoff has passed, then dispatches once the queue is back", async () => {
    const event = await publishTestEvent();
    const clock = new MutableClock(new Date());
    const registry = registryWith("audit.userRegistered");
    await aDispatcher(new FailingQueue(), registry, clock).dispatchBatch();
    const queue = new RecordingQueue();
    const dispatcher = aDispatcher(queue, registry, clock);

    clock.advanceSeconds(4);
    const tooEarly = await dispatcher.dispatchBatch();
    clock.advanceSeconds(2);
    const onTime = await dispatcher.dispatchBatch();

    expect(tooEarly).toBe(0);
    expect(onTime).toBe(1);
    expect(queue.jobs).toHaveLength(1);
    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row?.status).toBe(OUTBOX_STATUS.DISPATCHED);
  });
});

describe("an event that can never be dispatched (review M12)", () => {
  const ATTEMPTS_BEFORE_DEAD = 10;
  const LONGER_THAN_ANY_BACKOFF_SECONDS = 2 * 60 * 60;

  async function failDispatchTimes(
    clock: MutableClock,
    registry: EventHandlerRegistry,
    times: number,
  ): Promise<void> {
    for (let attempt = 1; attempt <= times; attempt += 1) {
      clock.advanceSeconds(LONGER_THAN_ANY_BACKOFF_SECONDS);
      await aDispatcher(new FailingQueue(), registry, clock).dispatchBatch();
    }
  }

  it("keeps retrying through the ninth failure", async () => {
    const event = await publishTestEvent();
    const clock = new MutableClock(new Date());

    await failDispatchTimes(clock, registryWith("audit.userRegistered"), ATTEMPTS_BEFORE_DEAD - 1);

    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row).toMatchObject({ status: OUTBOX_STATUS.PENDING, dispatchAttempts: 9 });
  });

  it("is set to DEAD after the tenth failed attempt and reported with its id, type and attempts", async () => {
    const event = await publishTestEvent();
    const clock = new MutableClock(new Date());

    await failDispatchTimes(clock, registryWith("audit.userRegistered"), ATTEMPTS_BEFORE_DEAD);

    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row).toMatchObject({
      status: OUTBOX_STATUS.DEAD,
      dispatchAttempts: ATTEMPTS_BEFORE_DEAD,
      lastError: "Error ECONNREFUSED",
      lockedUntil: null,
    });
    const reports = logs
      .lines()
      .filter((line) => line["level"] === 50 && line["eventId"] === event.eventId);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      eventType: "iam.user.registered",
      attempts: ATTEMPTS_BEFORE_DEAD,
    });
  });

  it("is never claimed again once it is DEAD, even after the queue is back", async () => {
    const event = await publishTestEvent();
    const clock = new MutableClock(new Date());
    const registry = registryWith("audit.userRegistered");
    await failDispatchTimes(clock, registry, ATTEMPTS_BEFORE_DEAD);
    const queue = new RecordingQueue();

    clock.advanceSeconds(LONGER_THAN_ANY_BACKOFF_SECONDS);
    const handled = await aDispatcher(queue, registry, clock).dispatchBatch();

    expect(handled).toBe(0);
    expect(queue.jobs).toEqual([]);
    const row = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(row?.status).toBe(OUTBOX_STATUS.DEAD);
  });
});

describe("dispatch backoff", () => {
  it("waits 5 s, 30 s, 2 min, 10 min and then 1 h", () => {
    const delaysInSeconds = [0, 1, 2, 3, 4, 9].map(
      (attempts) => dispatchBackoffMs(attempts) / 1000,
    );

    expect(delaysInSeconds).toEqual([5, 30, 120, 600, 3600, 3600]);
  });
});
