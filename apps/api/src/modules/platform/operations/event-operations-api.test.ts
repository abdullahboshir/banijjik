import { OUTBOX_STATUS, PLATFORM_AUDIT_ACTION, PLATFORM_ROLE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deadLetter } from "../../../kernel/events/dead-letter.js";
import { advancePosition } from "../../../kernel/events/stream-position.js";
import { callApi } from "../../../test-support/auth-api-client.js";
import { outboxModel, publishTestEvent } from "../../../test-support/event-fixtures.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { createPlatformActor, type PlatformActor } from "../../../test-support/platform-world.js";
import { runWithRequestContext } from "../../../kernel/context/index.js";

registerIamApiModels();

let harness: IamApiHarness;
let superAdmin: PlatformActor;
let support: PlatformActor;
const HANDLER_KEY = "ledger.post";

beforeAll(async () => {
  harness = await startIamApi();
  superAdmin = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
  support = await createPlatformActor(harness.app, harness.connections, [PLATFORM_ROLE.SUPPORT]);
});

afterAll(async () => {
  await harness.dispose();
});

/** A handler job that failed its last attempt, written the way the worker writes it. */
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
  const row = await harness.connections.platform
    .collection("event_dead_letters")
    .findOne({ eventId });
  return row?.["eventDeadLetterId"] as string;
}

async function auditRowsOf(targetId: string) {
  return harness.connections.platform
    .collection("platform_audit_logs")
    .find({ targetId })
    .toArray();
}

describe("GET /platform/event-dead-letters", () => {
  it("lists dead letters newest first, paged, and filters by status", async () => {
    const replayedId = await failedLetter();
    await failedLetter();
    await superAdmin.call("post", `/event-dead-letters/${replayedId}/replay`);

    const paged = await superAdmin.call("get", "/event-dead-letters?limit=1&page=1");
    const failedOnly = await superAdmin.call("get", "/event-dead-letters?status=FAILED&limit=100");
    const replayedOnly = await superAdmin.call(
      "get",
      "/event-dead-letters?status=REPLAY_REQUESTED&limit=100",
    );

    expect(paged.status).toBe(200);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toMatchObject({ page: 1, limit: 1, hasNext: true });
    expect(failedOnly.body.data.every((row: { status: string }) => row.status === "FAILED")).toBe(
      true,
    );
    expect(
      replayedOnly.body.data.map((row: { eventDeadLetterId: string }) => row.eventDeadLetterId),
    ).toContain(replayedId);
    expect(paged.body.data[0]).toMatchObject({
      handlerKey: HANDLER_KEY,
      eventType: "iam.user.registered",
      attempts: 5,
      lastError: "Error",
    });
  });

  it("refuses a bad status with a validation error", async () => {
    const response = await superAdmin.call("get", "/event-dead-letters?status=NOPE");

    expect(response.status).toBe(400);
  });
});

describe("replaying a dead letter", () => {
  it("marks it REPLAY_REQUESTED, not REPLAYED, and writes one platform audit entry", async () => {
    const id = await failedLetter();

    const response = await superAdmin.call("post", `/event-dead-letters/${id}/replay`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ eventDeadLetterId: id, status: "REPLAY_REQUESTED" });
    const rows = await auditRowsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: PLATFORM_AUDIT_ACTION.EVENT_DEAD_LETTER_REPLAY_REQUESTED,
      targetType: "event_dead_letter",
    });
  });

  it("answers 422 for a second replay and 404 for an unknown id, writing no second audit entry", async () => {
    const id = await failedLetter();
    await superAdmin.call("post", `/event-dead-letters/${id}/replay`);

    const again = await superAdmin.call("post", `/event-dead-letters/${id}/replay`);
    const unknown = await superAdmin.call("post", `/event-dead-letters/${newId()}/replay`);

    expect(again.status).toBe(422);
    expect(again.body.error.details.ruleKey).toBe("EVENT_DEAD_LETTER_NOT_FAILED");
    expect(unknown.status).toBe(404);
    expect(await auditRowsOf(id)).toHaveLength(1);
  });
});

describe("skipping a dead letter", () => {
  it("needs a reason", async () => {
    const id = await failedLetter();

    const response = await superAdmin.call("post", `/event-dead-letters/${id}/skip`, {});

    expect(response.status).toBe(400);
  });

  it("marks it SKIPPED with the reason, advances an ORDERED stream and audits the reason", async () => {
    const organizationId = newId();
    const orderingKey = `order:${newId()}`;
    await advancePosition({ handlerKey: HANDLER_KEY, organizationId, orderingKey }, 1);
    const id = await failedLetter({ orderingKey, streamSequence: 2, organizationId });

    const response = await superAdmin.call("post", `/event-dead-letters/${id}/skip`, {
      reason: "posted the journal entry by hand",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "SKIPPED",
      resolutionReason: "posted the journal entry by hand",
    });
    const position = await harness.connections.platform
      .collection("event_stream_positions")
      .findOne({ handlerKey: HANDLER_KEY, orderingKey });
    expect(position?.["lastSequence"]).toBe(2);
    const rows = await auditRowsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: PLATFORM_AUDIT_ACTION.EVENT_DEAD_LETTER_SKIPPED,
      reason: "posted the journal entry by hand",
      organizationId,
    });
  });

  it("answers 422 when earlier events of the stream were never handled, and changes nothing", async () => {
    const orderingKey = `order:${newId()}`;
    const id = await failedLetter({ orderingKey, streamSequence: 3, organizationId: newId() });

    const response = await superAdmin.call("post", `/event-dead-letters/${id}/skip`, {
      reason: "too early",
    });

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("EVENT_STREAM_NOT_AT_EVENT");
    expect(await auditRowsOf(id)).toHaveLength(0);
    const letters = await superAdmin.call("get", "/event-dead-letters?status=FAILED&limit=100");
    expect(
      letters.body.data.some((row: { eventDeadLetterId: string }) => row.eventDeadLetterId === id),
    ).toBe(true);
  });
});

describe("DEAD outbox events", () => {
  async function deadOutboxEvent(): Promise<string> {
    const event = await runWithRequestContext({ requestId: newId() }, () => publishTestEvent());
    await outboxModel().updateOne(
      { eventId: event.eventId },
      { $set: { status: OUTBOX_STATUS.DEAD, dispatchAttempts: 10, lastError: "Error" } },
    );
    return event.eventId;
  }

  it("lists them and a replay sets the event PENDING again, with an audit entry", async () => {
    const eventId = await deadOutboxEvent();

    const listed = await superAdmin.call("get", "/dead-outbox-events?limit=100");
    const replayed = await superAdmin.call("post", `/dead-outbox-events/${eventId}/replay`);
    const after = await outboxModel().findOne({ eventId }).lean();

    expect(listed.body.data.map((row: { eventId: string }) => row.eventId)).toContain(eventId);
    expect(replayed.status).toBe(200);
    expect(after).toMatchObject({ status: "PENDING", dispatchAttempts: 0 });
    expect(await auditRowsOf(eventId)).toHaveLength(1);
  });

  it("answers 422 for an event that is not DEAD and 404 for an unknown one", async () => {
    const pending = await publishTestEvent();

    const notDead = await superAdmin.call("post", `/dead-outbox-events/${pending.eventId}/replay`);
    const unknown = await superAdmin.call("post", `/dead-outbox-events/${newId()}/replay`);

    expect(notDead.status).toBe(422);
    expect(unknown.status).toBe(404);
  });
});

describe("who may use it", () => {
  it("refuses SUPPORT for both lists and every action (403) and answers 401 without a session", async () => {
    const id = await failedLetter();

    const responses = await Promise.all([
      support.call("get", "/event-dead-letters"),
      support.call("get", "/dead-outbox-events"),
      support.call("post", `/event-dead-letters/${id}/replay`),
      support.call("post", `/event-dead-letters/${id}/skip`, { reason: "no" }),
      support.call("post", `/dead-outbox-events/${newId()}/replay`),
    ]);
    const anonymous = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/event-dead-letters",
    });

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403]);
    expect(anonymous.status).toBe(401);
    expect(await auditRowsOf(id)).toHaveLength(0);
  });
});
