import { EVENT_TYPE, OUTBOX_STATUS } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runWithRequestContext } from "../context/index.js";
import { initializeModels, models, withTransaction } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { AppError } from "../http/app-error.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { publishEvent } from "./publish-event.js";
import { registerEventModels } from "./register-event-models.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";

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
  await models({}).get(OUTBOX_EVENT_MODEL_NAME).deleteMany({});
});

function outbox() {
  return models({}).get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME);
}

const organizationId = newId();
const userId = newId();
const requestId = newId();

function asTenantRequest<Result>(work: () => Promise<Result>): Promise<Result> {
  return runWithRequestContext({ requestId, organizationId, userId }, work);
}

describe("publishEvent", () => {
  it("throws outside a transaction, because an event may never exist without its change", async () => {
    const attempt = asTenantRequest(() =>
      publishEvent(EVENT_TYPE.ROLE_CREATED, { roleId: newId() }),
    );

    await expect(attempt).rejects.toThrow(AppError);
    await expect(attempt).rejects.toThrow(/event_needs_transaction/);
    expect(await outbox().countDocuments()).toBe(0);
  });

  it("writes a pending outbox row with the envelope fields when the transaction commits", async () => {
    const roleId = newId();

    await asTenantRequest(() =>
      withTransaction(() => publishEvent(EVENT_TYPE.ROLE_CREATED, { roleId })),
    );

    const rows = await outbox().find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "iam.role.created",
      version: 1,
      organizationId,
      actorUserId: userId,
      requestId,
      payload: { roleId },
      status: OUTBOX_STATUS.PENDING,
      dispatchAttempts: 0,
    });
    expect(rows[0]?.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[0]?.nextAttemptAt).toEqual(rows[0]?.occurredAt);
  });

  it("leaves no row when the transaction aborts", async () => {
    const attempt = asTenantRequest(() =>
      withTransaction(async () => {
        await publishEvent(EVENT_TYPE.ROLE_CREATED, { roleId: newId() });
        throw new Error("the change failed");
      }),
    );

    await expect(attempt).rejects.toThrow("the change failed");
    expect(await outbox().countDocuments()).toBe(0);
  });

  it("stores a null organization and actor for a user-level event and takes the version from the options", async () => {
    await runWithRequestContext({ requestId }, () =>
      withTransaction(() => publishEvent(EVENT_TYPE.USER_REGISTERED, { userId }, { version: 2 })),
    );

    const row = await outbox().findOne({}).lean();
    expect(row).toMatchObject({ organizationId: null, actorUserId: null, version: 2 });
  });
});
