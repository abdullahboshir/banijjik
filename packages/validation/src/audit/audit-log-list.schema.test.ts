import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { auditLogListQuerySchema } from "./audit-log-list.schema.js";

describe("auditLogListQuerySchema", () => {
  it("accepts an empty query and applies the paging defaults", () => {
    const parsed = auditLogListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("parses every filter", () => {
    const entityId = newId();
    const parsed = auditLogListQuerySchema.parse({
      entityType: "role",
      entityId,
      actorUserId: newId(),
      from: "2026-10-01",
      to: "2026-10-11T08:00:00.000Z",
    });
    expect(parsed.entityId).toBe(entityId);
    expect(parsed.from).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(parsed.to).toEqual(new Date("2026-10-11T08:00:00.000Z"));
  });

  it("rejects a date that is not ISO 8601", () => {
    expect(auditLogListQuerySchema.safeParse({ from: "yesterday" }).success).toBe(false);
  });

  it("rejects an unknown entity type and a limit above 100", () => {
    expect(auditLogListQuerySchema.safeParse({ entityType: "invoice" }).success).toBe(false);
    expect(auditLogListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects a range that ends before it starts", () => {
    const query = { from: "2026-10-11", to: "2026-10-01" };
    expect(auditLogListQuerySchema.safeParse(query).success).toBe(false);
  });
});
