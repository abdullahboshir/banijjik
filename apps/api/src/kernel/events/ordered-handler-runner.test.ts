import { EVENT_TYPE, MODULE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  outboxModel,
  publishTestEvent,
  type PublishedTestEvent,
} from "../../test-support/event-fixtures.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { initializeModels, models } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { EVENT_STREAM_POSITION_MODEL_NAME } from "./event-stream.schema.js";
import { EventHandlerRegistry, type HandlerOrdering } from "./event-handler-registry.js";
import type { EventJobData } from "./event-job.js";
import { runEventHandler, type HandlerRunResult } from "./handler-runner.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";
import { PROCESSED_EVENT_MODEL_NAME } from "./processed-event.schema.js";
import { registerEventModels } from "./register-event-models.js";
import { EVENT_STREAM_MODEL_NAME } from "./event-stream.schema.js";

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
  await models({}).get(PROCESSED_EVENT_MODEL_NAME).deleteMany({});
  await models({}).get(EVENT_STREAM_MODEL_NAME).deleteMany({});
  await models({}).get(EVENT_STREAM_POSITION_MODEL_NAME).deleteMany({});
});

const HANDLER_KEY = "ledger.post";
const ALWAYS_ON: ModuleEffectiveness = { isEffective: async () => true };
const ALWAYS_OFF: ModuleEffectiveness = { isEffective: async () => false };

interface Recorder {
  readonly registry: EventHandlerRegistry;
  /** The sequences the handler handled, in the order it handled them. */
  readonly handled: number[];
}

/** A handler that records the stream sequence of each event it handles; `failOn` makes it throw after a write. */
function recorder(ordering: HandlerOrdering, failOn: readonly number[] = []): Recorder {
  const handled: number[] = [];
  const registry = new EventHandlerRegistry();
  registry.register({
    handlerKey: HANDLER_KEY,
    moduleKey: MODULE_KEY.WORKFLOW,
    eventType: EVENT_TYPE.USER_REGISTERED,
    ...(ordering === "ORDERED" ? { ordering, streamPrefixes: ["order:"] as const } : { ordering }),
    handle: async (envelope) => {
      const event = await outboxModel().findOne({ eventId: envelope.eventId }).lean();
      const sequence = event?.streamSequence ?? 0;
      if (failOn.includes(sequence)) throw new Error(`failed on ${sequence}`);
      handled.push(sequence);
    },
  });
  return { registry, handled };
}

function jobFor(event: PublishedTestEvent): EventJobData {
  return {
    eventId: event.eventId,
    handlerKey: HANDLER_KEY,
    type: event.type,
    organizationId: event.organizationId,
  };
}

interface StreamPair {
  readonly first: PublishedTestEvent;
  readonly second: PublishedTestEvent;
}

/** Two events of one record: sequence 1 and 2. */
async function publishPair(): Promise<StreamPair> {
  const organizationId = newId();
  const orderingKey = `order:${newId()}`;
  const first = await publishTestEvent(organizationId, orderingKey);
  const second = await publishTestEvent(organizationId, orderingKey);
  return { first, second };
}

/** One event of a record of its own: sequence 1. */
function publishOne(): Promise<PublishedTestEvent> {
  return publishTestEvent(newId(), `order:${newId()}`);
}

function run(
  event: PublishedTestEvent,
  registry: EventHandlerRegistry,
  effectiveness: ModuleEffectiveness = ALWAYS_ON,
): Promise<HandlerRunResult> {
  return runEventHandler(jobFor(event), registry, effectiveness);
}

async function positionOf(event: PublishedTestEvent): Promise<number> {
  const stored = await outboxModel().findOne({ eventId: event.eventId }).lean();
  const position = await models({})
    .get(EVENT_STREAM_POSITION_MODEL_NAME)
    .findOne({ handlerKey: HANDLER_KEY, orderingKey: stored?.orderingKey })
    .lean<{ lastSequence: number }>();
  return position?.lastSequence ?? 0;
}

describe("an ORDERED handler", () => {
  it("makes an event that arrives before its predecessor wait, then handles both in order", async () => {
    const { first, second } = await publishPair();
    const probe = recorder("ORDERED");

    const early = await run(second, probe.registry);
    const markersWhileWaiting = await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments();
    const one = await run(first, probe.registry);
    const two = await run(second, probe.registry);

    expect(early).toBe("WAITING_FOR_EARLIER_EVENT");
    expect(markersWhileWaiting).toBe(0);
    expect([one, two]).toEqual(["HANDLED", "HANDLED"]);
    expect(probe.handled).toEqual([1, 2]);
    expect(await positionOf(first)).toBe(2);
  });

  it("treats a repeated delivery of a handled event as already processed and does not run the handler again", async () => {
    const first = await publishOne();
    const probe = recorder("ORDERED");
    await run(first, probe.registry);

    const again = await run(first, probe.registry);

    expect(again).toBe("ALREADY_PROCESSED");
    expect(probe.handled).toEqual([1]);
    expect(await positionOf(first)).toBe(1);
  });

  it("rolls the effect, the marker and the position back together when the handler throws", async () => {
    const { first, second } = await publishPair();
    const probe = recorder("ORDERED", [2]);
    await run(first, probe.registry);

    await expect(run(second, probe.registry)).rejects.toThrow("failed on 2");

    expect(probe.handled).toEqual([1]);
    expect(await positionOf(second)).toBe(1);
    expect(
      await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments({ eventId: second.eventId }),
    ).toBe(0);
  });

  it("lets two streams move independently: a waiting stream does not hold another back", async () => {
    const { first: aFirst, second: aSecond } = await publishPair();
    const bFirst = await publishOne();
    const probe = recorder("ORDERED");

    const waiting = await run(aSecond, probe.registry);
    const other = await run(bFirst, probe.registry);
    const unblocked = await run(aFirst, probe.registry);

    expect(waiting).toBe("WAITING_FOR_EARLIER_EVENT");
    expect(other).toBe("HANDLED");
    expect(unblocked).toBe("HANDLED");
  });

  it("moves its position past an event whose module is off, so the next event runs", async () => {
    const { first, second } = await publishPair();
    const probe = recorder("ORDERED");

    const skipped = await run(first, probe.registry, ALWAYS_OFF);
    const next = await run(second, probe.registry, ALWAYS_ON);

    expect(skipped).toBe("SKIPPED_MODULE_OFF");
    expect(next).toBe("HANDLED");
    expect(probe.handled).toEqual([2]);
    expect(await positionOf(first)).toBe(2);
    expect(
      await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments({ eventId: first.eventId }),
    ).toBe(0);
  });

  it("makes a module-off event that is ahead of the position wait as well", async () => {
    const { second } = await publishPair();
    const probe = recorder("ORDERED");

    const result = await run(second, probe.registry, ALWAYS_OFF);

    expect(result).toBe("WAITING_FOR_EARLIER_EVENT");
  });

  it("runs the position and the marker in one transaction: a concurrent repeat handles the event once", async () => {
    const first = await publishOne();
    const probe = recorder("ORDERED");

    const results = await Promise.all([
      run(first, probe.registry).catch(() => "RETRY"),
      run(first, probe.registry).catch(() => "RETRY"),
    ]);

    expect(probe.handled).toEqual([1]);
    expect(results).toContain("HANDLED");
  });
});

describe("an UNORDERED handler and a keyless event", () => {
  it("runs events of a stream in whatever order they arrive, with no position kept", async () => {
    const { first, second } = await publishPair();
    const probe = recorder("UNORDERED");

    const later = await run(second, probe.registry);
    const earlier = await run(first, probe.registry);

    expect([later, earlier]).toEqual(["HANDLED", "HANDLED"]);
    expect(probe.handled).toEqual([2, 1]);
    expect(await models({}).get(EVENT_STREAM_POSITION_MODEL_NAME).countDocuments()).toBe(0);
  });

  it("runs an event without a key on an ORDERED handler like any other event", async () => {
    const event = await publishTestEvent(newId());
    const probe = recorder("ORDERED");

    const result = await run(event, probe.registry);

    expect(result).toBe("HANDLED");
    expect(await models({}).get(EVENT_STREAM_POSITION_MODEL_NAME).countDocuments()).toBe(0);
  });
});

describe("ordered stream step-over", () => {
  it("advances an unhandled NEXT event without a marker or handle call, and a repeat is already processed", async () => {
    const first = await publishOne();
    const probe = recorder("ORDERED");
    const handler = probe.registry.find(HANDLER_KEY);
    if (handler === undefined) throw new Error("missing handler");
    const registry = new EventHandlerRegistry();
    registry.register({ ...handler, eventType: EVENT_TYPE.MEMBER_JOINED });
    expect(await run(first, registry)).toBe("SKIPPED_NOT_HANDLED");
    expect(await positionOf(first)).toBe(1);
    expect(probe.handled).toEqual([]);
    expect(await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments()).toBe(0);
    expect(await run(first, registry)).toBe("ALREADY_PROCESSED");
  });

  it("advances through unhandled types while the module is off", async () => {
    const { first, second } = await publishPair();
    const probe = recorder("ORDERED");
    const handler = probe.registry.find(HANDLER_KEY);
    if (handler === undefined) throw new Error("missing handler");
    const registry = new EventHandlerRegistry();
    registry.register({ ...handler, eventType: EVENT_TYPE.MEMBER_JOINED });
    expect(await run(first, registry, ALWAYS_OFF)).toBe("SKIPPED_NOT_HANDLED");
    expect(await run(second, registry, ALWAYS_OFF)).toBe("SKIPPED_NOT_HANDLED");
    expect(await positionOf(first)).toBe(2);
    expect(probe.handled).toEqual([]);
    expect(await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments()).toBe(0);
  });

  it("refuses a handled type on an undeclared stream before any effect", async () => {
    const first = await publishTestEvent(newId(), `booking:${newId()}`);
    const probe = recorder("ORDERED");
    await expect(run(first, probe.registry)).rejects.toMatchObject({
      messageKey: "errors.event_handler_stream_mismatch",
      details: { handlerKey: HANDLER_KEY, orderingKey: expect.stringMatching(/^booking:/) },
    });
    expect(probe.handled).toEqual([]);
    expect(await models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments()).toBe(0);
    expect(await positionOf(first)).toBe(0);
  });
});
