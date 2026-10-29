import { describe, expect, it } from "vitest";
import { ORGANIZATION_HEADER } from "../config/storefront-config";
import { organizationIdFrom, requestHeadersFor } from "./organization-header";

const ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000001";

describe("organization header", () => {
  it("replaces spoofed organization and forwarded-host headers from the trusted host", () => {
    const client = new Headers({
      [ORGANIZATION_HEADER]: "0195f3a0-0000-7000-8000-000000000009",
      "x-forwarded-host": "victim.example.com",
    });

    const headers = requestHeadersFor(client, {
      organizationId: ORGANIZATION_ID,
      hostname: "shop.example.com",
    });

    expect(organizationIdFrom(headers)).toBe(ORGANIZATION_ID);
    expect(headers.get("x-forwarded-host")).toBe("shop.example.com");
  });

  it("removes a client's header for an unknown host", () => {
    const client = new Headers({ [ORGANIZATION_HEADER]: ORGANIZATION_ID });

    const headers = requestHeadersFor(client, undefined);

    expect(organizationIdFrom(headers)).toBeUndefined();
    expect(headers.get("x-forwarded-host")).toBeNull();
  });
});
