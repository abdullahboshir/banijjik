import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { auditApiPath, auditHref, parseAuditQuery } from "./audit-query";

describe("parseAuditQuery", () => {
  it("keeps a valid target type and organization id", () => {
    const organizationId = newId();
    expect(parseAuditQuery({ targetType: "package", organizationId })).toEqual({
      targetType: "package",
      organizationId,
      page: 1,
    });
  });

  it("drops an organization id that is not an id, so the API never gets it", () => {
    expect(parseAuditQuery({ organizationId: "not-an-id" }).organizationId).toBeUndefined();
  });

  it("drops an unknown target type", () => {
    expect(parseAuditQuery({ targetType: "everything" }).targetType).toBeUndefined();
  });
});

describe("audit paths", () => {
  it("builds the page URL and the API path from the same query", () => {
    const query = { targetType: "organization" as const, organizationId: undefined, page: 2 };
    expect(auditHref(query)).toBe("/audit?targetType=organization&page=2");
    expect(auditApiPath(query)).toBe(
      "/platform/audit-logs?page=2&limit=50&targetType=organization",
    );
  });
});
