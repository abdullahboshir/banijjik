import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { isUuidV7, newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { createAuditLog } from "./audit-log.entity.js";

const baseInput = {
  organizationId: newId(),
  action: AUDIT_ACTION.ROLE_CREATED,
  entityType: AUDIT_ENTITY_TYPE.role,
  entityId: newId(),
  requestId: newId(),
  occurredAt: new Date("2026-10-11T08:00:00.000Z"),
};

describe("createAuditLog", () => {
  it("gives every entry its own UUID v7", () => {
    const first = createAuditLog(baseInput);
    const second = createAuditLog(baseInput);
    expect(isUuidV7(first.auditLogId)).toBe(true);
    expect(first.auditLogId).not.toBe(second.auditLogId);
  });

  it("records an empty change set when the caller gives none", () => {
    expect(createAuditLog(baseInput).changes).toEqual({});
  });

  it("keeps the changes the caller gave", () => {
    const changes = { name: { to: "Cashier plus" } };
    expect(createAuditLog({ ...baseInput, changes }).changes).toEqual(changes);
  });
});
