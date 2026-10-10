import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, EVENT_TYPE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { initializeModels, withTransaction } from "../../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../../kernel/db/index.js";
import { publishEvent, registerEventModels } from "../../../../kernel/events/index.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { buildAuditRecorder, registerAuditModels } from "../index.js";

registerAuditModels();
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

/** One change in a transaction: an audit entry (tenant DB) and an outbox row (platform DB). */
async function changeWithAuditAndEvent(organizationId: string, failAfter: boolean): Promise<void> {
  const audit = buildAuditRecorder(new MutableClock());
  const roleId = newId();
  await runWithRequestContext({ requestId: newId(), organizationId, userId: newId() }, () =>
    withTransaction(async () => {
      await audit.record({
        action: AUDIT_ACTION.ROLE_CREATED,
        entityType: AUDIT_ENTITY_TYPE.role,
        entityId: roleId,
      });
      await publishEvent(EVENT_TYPE.ROLE_CREATED, { roleId });
      if (failAfter) throw new Error("the change failed after audit and event");
    }),
  );
}

async function countRows(organizationId: string): Promise<{ audit: number; outbox: number }> {
  const audit = await connections.tenantShared
    .collection("audit_logs")
    .countDocuments({ organizationId });
  const outbox = await connections.platform
    .collection("outbox_events")
    .countDocuments({ organizationId });
  return { audit, outbox };
}

describe("a change that writes an audit entry and publishes an event", () => {
  it("commits the audit row and the outbox row together", async () => {
    const organizationId = newId();

    await changeWithAuditAndEvent(organizationId, false);

    expect(await countRows(organizationId)).toEqual({ audit: 1, outbox: 1 });
  });

  it("leaves neither the audit row nor the outbox row when the transaction aborts", async () => {
    const organizationId = newId();

    await expect(changeWithAuditAndEvent(organizationId, true)).rejects.toThrow(
      "the change failed",
    );

    expect(await countRows(organizationId)).toEqual({ audit: 0, outbox: 0 });
  });
});
