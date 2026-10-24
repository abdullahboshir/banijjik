import { describe, expect, it } from "vitest";
import { ORGANIZATION_HEADER } from "../config/storefront-config";
import { organizationIdFrom, requestHeadersFor } from "./organization-header";

const ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000001";

describe("organization header", () => {
  it("replaces a header the client sent with the organization the host resolved to", () => {
    const client = new Headers({ [ORGANIZATION_HEADER]: "0195f3a0-0000-7000-8000-000000000009" });

    const headers = requestHeadersFor(client, ORGANIZATION_ID);

    expect(organizationIdFrom(headers)).toBe(ORGANIZATION_ID);
  });

  it("removes a client's header for an unknown host", () => {
    const client = new Headers({ [ORGANIZATION_HEADER]: ORGANIZATION_ID });

    expect(organizationIdFrom(requestHeadersFor(client, undefined))).toBeUndefined();
  });
});
