import { asId, newId, type OrganizationId, type SiteDomainId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  DOMAIN_OPERATION_ACTION,
  DOMAIN_OPERATION_STATE,
  DomainOperation,
} from "./domain-operation.entity.js";

describe("DomainOperation", () => {
  it("starts in-flight and can remember a provider hostname after a lost create", () => {
    const now = new Date("2026-10-29T04:00:00.000Z");
    const started = DomainOperation.start({
      organizationId: asId<OrganizationId>(newId()),
      siteDomainId: asId<SiteDomainId>(newId()),
      generation: 1,
      action: DOMAIN_OPERATION_ACTION.ENSURE,
      now,
    });
    expect(started.state).toBe(DOMAIN_OPERATION_STATE.IN_FLIGHT);
    const attached = started.attachProviderHostname({
      providerHostnameId: "cf-host-1",
      now: new Date("2026-10-29T04:01:00.000Z"),
    });
    expect(attached.providerHostnameId).toBe("cf-host-1");
    expect(attached.state).toBe(DOMAIN_OPERATION_STATE.IN_FLIGHT);
    const done = attached.succeed({
      providerHostnameId: "cf-host-1",
      now: new Date("2026-10-29T04:02:00.000Z"),
    });
    expect(done.state).toBe(DOMAIN_OPERATION_STATE.SUCCEEDED);
  });
});
