import { EVENT_TYPE, MODULE_KEY } from "@banijjik/contracts";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { outboxModel, publishTestEvent } from "../../test-support/event-fixtures.js";
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
import { findRequestContext, getSystemReason } from "../context/index.js";
import { getActiveSession, initializeModels, models, sessionOption } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import type { LogCapture } from "../../test-support/log-capture.js";
import { EventHandlerRegistry, type EventHandler } from "./event-handler-registry.js";
import { startEventProcessing, type EventProcessing } from "./event-processing.js";
import { buildEventJobId, EVENT_QUEUE_NAME } from "./event-job.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "./dead-letter.schema.js";
import { PROCESSED_EVENT_MODEL_NAME } from "./processed-event.schema.js";
import { registerEventModels } from "./register-event-models.js";
import * as observability from "../observability/report-error.js";
import { Queue } from "bullmq";
import type { EventJobData } from "./event-job.js";

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
  await models({}).get(PROCESSED_EVENT_MODEL_NAME).deleteMany({});
  await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).deleteMany({});
});

function handlerOf(
  handlerKey: string,
  handle: EventHandler["handle"],
): EventHandler<typeof EVENT_TYPE.USER_REGISTERED> {
  return {
    handlerKey,
    moduleKey: MODULE_KEY.IAM,
    eventType: EVENT_TYPE.USER_REGISTERED,
    ordering: "UNORDERED",
    handle,
  };
}

function countMarkers(eventId: string, handlerKey: string): Promise<number> {
  return models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments({ eventId, handlerKey });
}

describeWithRedis("event worker", (redisUrl) => {
  let scope: RedisTestScope;
  let processing: EventProcessing | undefined;

  beforeEach(() => {
    scope = createRedisTestScope(redisUrl);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (processing !== undefined) {
      for (const task of processing.shutdownTasks) await task.run();
      processing = undefined;
    }
    await scope.dispose();
  });

  function start(registry: EventHandlerRegistry): EventProcessing {
    processing = startEventProcessing({
      redis: scope.client,
      registry,
      effectiveness: { isEffective: async () => true },
      clock: new MutableClock(new Date()),
      pollIntervalMs: 50,
      queuePrefix: scope.prefix,
      retryBaseDelayMs: 20,
    });
    return processing;
  }

  it("retries a handler that fails twice and runs it a third time, leaving one marker", async () => {
    let calls = 0;
    const registry = new EventHandlerRegistry();
    registry.register(
      handlerOf("test.flaky", async () => {
        calls += 1;
        if (calls <= 2) throw new Error("temporary failure");
      }),
    );
    const event = await publishTestEvent();

    start(registry);
    await waitFor("the third call to succeed", async () =>
      (await countMarkers(event.eventId, "test.flaky")) === 1 ? true : undefined,
    );

    expect(calls).toBe(3);
    expect(await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).countDocuments()).toBe(0);
  });

  it("dead-letters a handler that always fails after 5 attempts and still runs the other handler", async () => {
    const reportSpy = vi.spyOn(observability, "reportError");
    let failingCalls = 0;
    const registry = new EventHandlerRegistry();
    registry.register(
      handlerOf("test.broken", async () => {
        failingCalls += 1;
        throw new Error("always failing");
      }),
    );
    registry.register(handlerOf("test.healthy", async () => undefined));
    const event = await publishTestEvent();

    start(registry);
    const deadLetter = await waitFor(
      "the dead letter",
      async () =>
        (await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).findOne({}).lean()) ?? undefined,
    );

    expect(failingCalls).toBe(5);
    expect(deadLetter).toMatchObject({
      eventId: event.eventId,
      handlerKey: "test.broken",
      type: "iam.user.registered",
      attempts: 5,
      lastError: "Error",
    });
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy.mock.calls[0]?.[1]).toMatchObject({
      eventId: event.eventId,
      handlerKey: "test.broken",
      attempts: 5,
    });
    expect(await countMarkers(event.eventId, "test.healthy")).toBe(1);
    expect(await countMarkers(event.eventId, "test.broken")).toBe(0);
  });

  it("does not run a handler again when the same pair is delivered twice", async () => {
    let calls = 0;
    const registry = new EventHandlerRegistry();
    registry.register(handlerOf("test.once", async () => void (calls += 1)));
    const event = await publishTestEvent();
    start(registry);
    await waitFor("the first run", async () => (calls === 1 ? true : undefined));

    const queue = new Queue<EventJobData>(EVENT_QUEUE_NAME, {
      connection: scope.client,
      prefix: scope.prefix,
    });
    await queue.add(
      "test.once",
      {
        eventId: event.eventId,
        handlerKey: "test.once",
        type: event.type,
        organizationId: null,
      },
      { jobId: `${buildEventJobId(event.eventId, "test.once")}-again` },
    );
    await waitFor("the second delivery to finish", async () =>
      (await queue.getCompletedCount()) >= 2 ? true : undefined,
    );
    await queue.close();

    expect(calls).toBe(1);
    expect(await countMarkers(event.eventId, "test.once")).toBe(1);
  });

  it("rolls the marker back together with the handler's own write when the handler throws", async () => {
    const registry = new EventHandlerRegistry();
    registry.register(
      handlerOf("test.writes", async () => {
        await models({})
          .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
          .create(
            [
              {
                eventDeadLetterId: "00000000-0000-7000-8000-000000000001",
                eventId: "side-effect",
                handlerKey: "test.writes",
                type: "x",
                attempts: 1,
                lastError: "x",
                failedAt: new Date(),
              },
            ],
            sessionOption(getActiveSession()),
          );
        throw new Error("fails after writing");
      }),
    );
    const event = await publishTestEvent();

    start(registry);
    await waitFor("the retries to be used up", async () =>
      (await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).findOne({ eventId: event.eventId }))
        ? true
        : undefined,
    );

    expect(await countMarkers(event.eventId, "test.writes")).toBe(0);
    expect(
      await models({}).get(EVENT_DEAD_LETTER_MODEL_NAME).countDocuments({ eventId: "side-effect" }),
    ).toBe(0);
  });

  it("runs the handler in the event's organization context", async () => {
    const organizationId = "0198d2b0-0000-7000-8000-00000000a001";
    let seen: unknown;
    const registry = new EventHandlerRegistry();
    registry.register(
      handlerOf("test.context", async () => {
        const context = findRequestContext();
        seen = { organizationId: context?.organizationId, requestId: context?.requestId };
      }),
    );
    const event = await publishTestEvent(organizationId);

    start(registry);
    await waitFor("the handler", async () => (seen === undefined ? undefined : true));

    expect(seen).toEqual({ organizationId, requestId: `event:${event.eventId}` });
  });

  it("runs a null-organization event as a scheduled system job with one system_access line", async () => {
    let reason: unknown;
    const registry = new EventHandlerRegistry();
    registry.register(
      handlerOf("test.system", async () => {
        reason = getSystemReason();
      }),
    );
    const event = await publishTestEvent(null);

    start(registry);
    await waitFor("the handler", async () => (reason === undefined ? undefined : true));

    expect(reason).toBe("SCHEDULED_JOB");
    const lines = logs
      .lines()
      .filter(
        (line) =>
          line["event"] === "system_access" && line["requestId"] === `event:${event.eventId}`,
      );
    expect(lines).toHaveLength(1);
  });
});
