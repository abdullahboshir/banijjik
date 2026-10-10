import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { installTestLogger } from "../../test-support/test-databases.js";
import { findRequestContext, runWithRequestContext } from "../context/index.js";
import { runInOrganizationContext } from "./run-in-organization-context.js";

describe("runInOrganizationContext", () => {
  it("sets the organization with every location and logs one tenancy.context_established line", async () => {
    const logs = installTestLogger();
    const organizationId = newId();

    const seen = await runInOrganizationContext(organizationId, async () => findRequestContext());

    expect(seen).toMatchObject({ organizationId, allowedLocationIds: "ALL" });
    const lines = logs.lines().filter((line) => line["event"] === "tenancy.context_established");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ organizationId, level: 30 });
  });

  it("keeps the user and request id of the surrounding request", async () => {
    installTestLogger();
    const seen = await runWithRequestContext({ requestId: "r1", userId: "u1" }, () =>
      runInOrganizationContext(newId(), async () => findRequestContext()),
    );

    expect(seen).toMatchObject({ requestId: "r1", userId: "u1" });
  });

  it("refuses to move a request that already belongs to another organization", async () => {
    installTestLogger();
    const attempt = runWithRequestContext({ requestId: "r2", organizationId: newId() }, () =>
      runInOrganizationContext(newId(), async () => "never"),
    );

    await expect(attempt).rejects.toThrow(/errors\.cross_organization_access/);
  });
});
