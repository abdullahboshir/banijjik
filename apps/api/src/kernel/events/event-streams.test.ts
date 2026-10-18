import { EVENT_TYPE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { outboxModel, publishTestEvent } from "../../test-support/event-fixtures.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { runWithRequestContext } from "../context/index.js";
import { initializeModels, models, withTransaction } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { EVENT_STREAM_MODEL_NAME } from "./event-stream.schema.js";
import { publishEvent } from "./publish-event.js";
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
  await models({}).get(EVENT_STREAM_MODEL_NAME).deleteMany({});
});

const organizationId = newId();

describe("the sequence of an ordering key", () => {
  it("numbers three events of one record 1, 2 and 3", async () => {
    const orderingKey = `order:${newId()}`;

    const first = await publishTestEvent(organizationId, orderingKey);
    const second = await publishTestEvent(organizationId, orderingKey);
    const third = await publishTestEvent(organizationId, orderingKey);

    expect([first, second, third].map((event) => event.streamSequence)).toEqual([1, 2, 3]);
    const stored = await outboxModel().find({ orderingKey }).sort({ streamSequence: 1 }).lean();
    expect(stored.map((row) => row.streamSequence)).toEqual([1, 2, 3]);
  });

  it("counts two records separately, and the same key in two organizations separately", async () => {
    const orderKey = `order:${newId()}`;
    const bookingKey = `booking:${newId()}`;

    const firstOrder = await publishTestEvent(organizationId, orderKey);
    const firstBooking = await publishTestEvent(organizationId, bookingKey);
    const secondOrder = await publishTestEvent(organizationId, orderKey);
    const otherOrganization = await publishTestEvent(newId(), orderKey);

    expect(firstOrder.streamSequence).toBe(1);
    expect(firstBooking.streamSequence).toBe(1);
    expect(secondOrder.streamSequence).toBe(2);
    expect(otherOrganization.streamSequence).toBe(1);
  });

  it("gives an event without a key no stream and no sequence", async () => {
    const event = await publishTestEvent(organizationId);

    expect(event.streamSequence).toBeNull();
    const stored = await outboxModel().findOne({ eventId: event.eventId }).lean();
    expect(stored?.orderingKey).toBeNull();
    expect(await models({}).get(EVENT_STREAM_MODEL_NAME).countDocuments()).toBe(0);
  });

  it("rolls the counter back with the transaction, so the next event gets the same number and no gap blocks the stream", async () => {
    const orderingKey = `order:${newId()}`;
    await publishTestEvent(organizationId, orderingKey);

    await expect(
      runWithRequestContext({ requestId: newId(), organizationId }, () =>
        withTransaction(async () => {
          await publishEvent(EVENT_TYPE.USER_REGISTERED, { userId: newId() }, { orderingKey });
          throw new Error("the change failed after the event was written");
        }),
      ),
    ).rejects.toThrow("the change failed");
    const next = await publishTestEvent(organizationId, orderingKey);

    expect(next.streamSequence).toBe(2);
    const stream = await models({})
      .get(EVENT_STREAM_MODEL_NAME)
      .findOne({ orderingKey })
      .lean<{ lastSequence: number }>();
    expect(stream?.lastSequence).toBe(2);
    expect(await outboxModel().countDocuments({ orderingKey })).toBe(2);
  });

  it("numbers events of one stream published at the same moment without a repeat or a gap", async () => {
    const orderingKey = `order:${newId()}`;
    await publishTestEvent(organizationId, orderingKey);

    await Promise.all(
      Array.from({ length: 5 }, () =>
        runWithRequestContext({ requestId: newId(), organizationId }, () =>
          withTransaction(() =>
            publishEvent(EVENT_TYPE.USER_REGISTERED, { userId: newId() }, { orderingKey }),
          ),
        ),
      ),
    );

    const stored = await outboxModel().find({ orderingKey }).sort({ streamSequence: 1 }).lean();
    expect(stored.map((row) => row.streamSequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
