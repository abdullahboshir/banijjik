import { PLATFORM_AUDIT_ACTION, PLATFORM_AUDIT_TARGET_TYPE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { initializeModels, models, withTransaction } from "../../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../../kernel/db/index.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { buildPlatformAuditRecorder, registerAuditModels } from "../index.js";
import {
  PLATFORM_AUDIT_LOG_MODEL_NAME,
  type PlatformAuditLogDocument,
} from "./platform-audit-log.schema.js";

registerAuditModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

const recorder = buildPlatformAuditRecorder(new MutableClock());

function operatorContext() {
  return {
    requestId: newId(),
    userId: newId(),
    platformOperatorId: newId(),
  };
}

function recordSuspension(targetId: string, failAfter: boolean): Promise<void> {
  return runWithRequestContext(operatorContext(), () =>
    withTransaction(async () => {
      await recorder.record({
        action: PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.organization,
        targetId,
        organizationId: targetId,
        changes: { status: { from: "ACTIVE", to: "SUSPENDED" } },
        reason: "test",
      });
      if (failAfter) throw new Error("the change failed after the audit entry");
    }),
  );
}

function entriesOf(targetId: string) {
  return connections.platform.collection("platform_audit_logs").find({ targetId }).toArray();
}

describe("the platform audit recorder", () => {
  it("writes the entry with the operator, the user and the request id of the context", async () => {
    const targetId = newId();
    const context = operatorContext();

    await runWithRequestContext(context, () =>
      withTransaction(() =>
        recorder.record({
          action: PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
          targetType: PLATFORM_AUDIT_TARGET_TYPE.organization,
          targetId,
        }),
      ),
    );

    const [entry] = await entriesOf(targetId);
    expect(entry).toMatchObject({
      actorPlatformOperatorId: context.platformOperatorId,
      actorUserId: context.userId,
      requestId: context.requestId,
      changes: {},
    });
  });

  it("leaves no entry when the change rolls back", async () => {
    const targetId = newId();

    await expect(recordSuspension(targetId, true)).rejects.toThrow("the change failed");

    expect(await entriesOf(targetId)).toEqual([]);
  });

  it("refuses to write outside a transaction", async () => {
    await expect(
      runWithRequestContext(operatorContext(), () =>
        recorder.record({
          action: PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
          targetType: PLATFORM_AUDIT_TARGET_TYPE.organization,
          targetId: newId(),
        }),
      ),
    ).rejects.toThrow();
  });

  it("refuses a context without an operator", async () => {
    await expect(
      runWithRequestContext({ requestId: newId(), userId: newId() }, () =>
        withTransaction(() =>
          recorder.record({
            action: PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
            targetType: PLATFORM_AUDIT_TARGET_TYPE.organization,
            targetId: newId(),
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("is append-only: an entry can be neither changed nor deleted", async () => {
    const targetId = newId();
    await recordSuspension(targetId, false);
    const model = models({}).get<PlatformAuditLogDocument>(PLATFORM_AUDIT_LOG_MODEL_NAME);

    await expect(model.updateOne({ targetId }, { $set: { reason: "edited" } })).rejects.toThrow();
    await expect(model.deleteOne({ targetId })).rejects.toThrow();

    expect(await entriesOf(targetId)).toHaveLength(1);
  });
});
