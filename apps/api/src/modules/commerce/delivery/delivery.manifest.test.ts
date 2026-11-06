import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { deliveryManifest } from "./module.manifest.js";

describe("delivery manifest", () => {
  it("declares the core delivery module contract", () => {
    expect(deliveryManifest.key).toBe(MODULE_KEY.DELIVERY);
    expect(deliveryManifest.moduleClass).toBe(MODULE_CLASS.CORE);
    expect(deliveryManifest.tenantCanDisable).toBe(false);
  });

  it("lists all required admin routes", () => {
    expect(deliveryManifest.routes.admin).toEqual([
      "/orgs/:organizationId/delivery/assignments",
      "/orgs/:organizationId/delivery/handovers",
      "/orgs/:organizationId/delivery/handovers/:riderCashHandoverId/reverse",
    ]);
  });
});
