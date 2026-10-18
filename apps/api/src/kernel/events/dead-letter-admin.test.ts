import { EVENT_DEAD_LETTER_STATUS, OUTBOX_STATUS } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { outboxModel, publishTestEvent } from "../../test-support/event-fixtures.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { initializeModels, models, withTransaction } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import {
  listDeadLetters,
  listDeadOutboxEvents,
  replayDeadLetter,
  replayDeadOutboxEvent,
  skipDeadLetter,
} from "./dead-letter-admin.js";
import { deadLetter } from "./dead-letter.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "./dead-letter.schema.js";
import {
  EVENT_STREAM_MODEL_NAME,
  EVENT_STREAM_POSITION_MODEL_NAME,
} from "./event-stream.schema.js";
import { registerEventModels } from "./register-event-models.js";
import { advancePosition } from "./stream-position.js";

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
    EVENT_DEAD_LETTER_MODEL_NAME,
    EVENT_STREAM_MODEL_NAME,
    EVENT_STREAM_POSITION_MODEL_NAME,
  ]) {
    await models({}).get(name).deleteMany({});
  }
});

const OPERATOR_ID = newId();
const HANDLER_KEY = "ledger.post";

async function failedLetter(
  input: { orderingKey?: string; streamSequence?: number; organizationId?: string } = {},
): Promise<string> {
  const eventId = newId();
  await deadLetter({
    data: {
      eventId,
      handlerKey: HANDLER_KEY,
      type: "iam.user.registered",
      organizationId: input.organizationId ?? null,
    },
    attempts: 5,
    error: new Error("boom"),
    ...(input.orderingKey === undefined || input.streamSequence === undefined
      ? {}
      : { stream: { orderingKey: input.orderingKey, streamSequence: input.streamSequence } }),
  });
  const row = await models({})
    .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
    .findOne({ eventId })
    .lean<EventDeadLetterDocument>();
  return row?.eventDeadLetterId ?? "";
}

function inTransaction<Result>(work: () => Promise<Result>): Promise<Result> {
  return withTransaction(work);
}

describe("listing dead letters", () => {
  it("pages newest first and says whether another page exists", async () => {
    for (let index = 0; index < 3; index += 1) await failedLetter();

    const first = await listDeadLetters({ page: { page: 1, limit: 2 } });
    const second = await listDeadLetters({ page: { page: 2, limit: 2 } });

    expect(first.items).toHaveLength(2);
    expect(first.hasNext).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.hasNext).toBe(false);
    expect(first.items[0]?.status).toBe("FAILED");
  });

  it("filters by status", async () => {
    const replayed = await failedLetter();
    await failedLetter();
    await inTransaction(() =>
      replayDeadLetter({ eventDeadLetterId: replayed, operatorId: OPERATOR_ID }),
    );

    const onlyFailed = await listDeadLetters({
      status: EVENT_DEAD_LETTER_STATUS.FAILED,
      page: { page: 1, limit: 10 },
    });
    const onlyReplayed = await listDeadLetters({
      status: EVENT_DEAD_LETTER_STATUS.REPLAYED,
      page: { page: 1, limit: 10 },
    });

    expect(onlyFailed.items).toHaveLength(1);
    expect(onlyReplayed.items.map((item) => item.eventDeadLetterId)).toEqual([replayed]);
  });
});

describe("replaying a dead letter", () => {
  it("marks it REPLAYED for the worker to queue, with who and when", async () => {
    const id = await failedLetter();

    const result = await inTransaction(() =>
      replayDeadLetter({ eventDeadLetterId: id, operatorId: OPERATOR_ID }),
    );

    expect(result.kind).toBe("DONE");
    const row = await models({})
      .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
      .findOne({ eventDeadLetterId: id })
      .lean<EventDeadLetterDocument>();
    expect(row).toMatchObject({
      status: "REPLAYED",
      resolvedByPlatformOperatorId: OPERATOR_ID,
      requeuedAt: null,
    });
    expect(row?.resolvedAt).toBeInstanceOf(Date);
  });

  it("refuses an unknown id and a dead letter that is not FAILED any more", async () => {
    const id = await failedLetter();
    await inTransaction(() => replayDeadLetter({ eventDeadLetterId: id, operatorId: OPERATOR_ID }));

    const unknown = await inTransaction(() =>
      replayDeadLetter({ eventDeadLetterId: newId(), operatorId: OPERATOR_ID }),
    );
    const again = await inTransaction(() =>
      replayDeadLetter({ eventDeadLetterId: id, operatorId: OPERATOR_ID }),
    );

    expect(unknown.kind).toBe("NOT_FOUND");
    expect(again.kind).toBe("NOT_FAILED");
  });
});

describe("skipping a dead letter", () => {
  it("moves the handler's position past an event of an ORDERED stream, with the reason", async () => {
    const organizationId = newId();
    const orderingKey = `order:${newId()}`;
    await advancePosition({ handlerKey: HANDLER_KEY, organizationId, orderingKey }, 2);
    const id = await failedLetter({ orderingKey, streamSequence: 3, organizationId });

    const result = await inTransaction(() =>
      skipDeadLetter({ eventDeadLetterId: id, operatorId: OPERATOR_ID, reason: "posted by hand" }),
    );

    expect(result.kind).toBe("DONE");
    const position = await models({})
      .get(EVENT_STREAM_POSITION_MODEL_NAME)
      .findOne({ handlerKey: HANDLER_KEY, orderingKey })
      .lean<{ lastSequence: number }>();
    expect(position?.lastSequence).toBe(3);
    const row = await models({})
      .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
      .findOne({ eventDeadLetterId: id })
      .lean<EventDeadLetterDocument>();
    expect(row).toMatchObject({ status: "SKIPPED", resolutionReason: "posted by hand" });
  });

  it("refuses to jump over earlier events that were never handled, and changes nothing", async () => {
    const organizationId = newId();
    const orderingKey = `order:${newId()}`;
    const id = await failedLetter({ orderingKey, streamSequence: 3, organizationId });

    const result = await inTransaction(() =>
      skipDeadLetter({ eventDeadLetterId: id, operatorId: OPERATOR_ID, reason: "too early" }),
    );

    expect(result.kind).toBe("STREAM_NOT_AT_EVENT");
    expect(await models({}).get(EVENT_STREAM_POSITION_MODEL_NAME).countDocuments()).toBe(0);
    const row = await models({})
      .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
      .findOne({ eventDeadLetterId: id })
      .lean<EventDeadLetterDocument>();
    expect(row?.status).toBe("FAILED");
  });

  it("skips a dead letter of an unordered handler without touching any position", async () => {
    const id = await failedLetter();

    const result = await inTransaction(() =>
      skipDeadLetter({ eventDeadLetterId: id, operatorId: OPERATOR_ID, reason: "not needed" }),
    );

    expect(result.kind).toBe("DONE");
    expect(await models({}).get(EVENT_STREAM_POSITION_MODEL_NAME).countDocuments()).toBe(0);
  });
});

describe("DEAD outbox events", () => {
  async function deadOutboxEvent(): Promise<string> {
    const event = await publishTestEvent(newId());
    await outboxModel().updateOne(
      { eventId: event.eventId },
      { $set: { status: OUTBOX_STATUS.DEAD, dispatchAttempts: 10, lastError: "Error" } },
    );
    return event.eventId;
  }

  it("lists them and a replay sets the event PENDING again with its attempts reset", async () => {
    const eventId = await deadOutboxEvent();
    await publishTestEvent(newId());

    const listed = await listDeadOutboxEvents({ page: 1, limit: 10 });
    const result = await inTransaction(() => replayDeadOutboxEvent(eventId));

    expect(listed.items.map((item) => item.eventId)).toEqual([eventId]);
    expect(result.kind).toBe("DONE");
    const row = await outboxModel().findOne({ eventId }).lean();
    expect(row).toMatchObject({ status: "PENDING", dispatchAttempts: 0, lockedUntil: null });
    expect((await listDeadOutboxEvents({ page: 1, limit: 10 })).items).toHaveLength(0);
  });

  it("refuses an unknown event and an event that is not DEAD", async () => {
    const pending = await publishTestEvent(newId());

    const unknown = await inTransaction(() => replayDeadOutboxEvent(newId()));
    const notDead = await inTransaction(() => replayDeadOutboxEvent(pending.eventId));

    expect(unknown.kind).toBe("NOT_FOUND");
    expect(notDead.kind).toBe("NOT_DEAD");
  });
});
