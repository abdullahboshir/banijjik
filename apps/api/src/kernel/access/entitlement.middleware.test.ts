import { ACCESS_MODE, MODULE_CLASS, MODULE_KEY, type AccessMode } from "@banijjik/contracts";
import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { aManifest } from "../../test-support/manifest-fixtures.js";
import { createTestApp } from "../../test-support/test-app.js";
import { sendData } from "../http/index.js";
import { createModuleRegistry, defineModule } from "../modules/index.js";
import { createEntitlementGate } from "./entitlement.middleware.js";

const ORGANIZATION = "0192b3a4-0000-7000-8000-000000000001";
const registry = createModuleRegistry(
  [
    aManifest("iam", {
      moduleClass: MODULE_CLASS.SYSTEM,
      routes: { admin: ["/orgs/:organizationId/roles"] },
    }),
    aManifest("workflow", { routes: { admin: ["/orgs/:organizationId/flows"] } }),
  ].map(defineModule),
);

function gatedApp(accessMode: AccessMode, modules: readonly string[]) {
  const tenant = Router({ mergeParams: true });
  tenant.use(
    createEntitlementGate({
      registry,
      // Safe: the test lists module keys of the catalogue.
      config: { current: async () => ({ accessMode, modules: modules as never }) },
    }),
  );
  tenant.all(/.*/, (_request, response) => sendData(response, { reached: true }));
  return createTestApp((router) => router.use("/orgs/:organizationId", tenant)).app;
}

function path(suffix: string): string {
  return `/api/v1/orgs/${ORGANIZATION}${suffix}`;
}

describe("entitlement gate", () => {
  it("lets a route through when its owner module is effective", async () => {
    const app = gatedApp(ACCESS_MODE.FULL, [MODULE_KEY.IAM, MODULE_KEY.WORKFLOW]);

    const response = await request(app).get(path("/flows/7"));

    expect(response.status).toBe(200);
  });

  it("answers 403 MODULE_DISABLED with the module key when the owner module is not effective", async () => {
    const app = gatedApp(ACCESS_MODE.FULL, [MODULE_KEY.IAM]);

    const response = await request(app).get(path("/flows"));

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "MODULE_DISABLED",
      details: { moduleKey: "workflow" },
    });
  });

  it("answers 403 ORG_READ_ONLY for a write but lets a read through when the organization is READ_ONLY", async () => {
    const app = gatedApp(ACCESS_MODE.READ_ONLY, [MODULE_KEY.IAM, MODULE_KEY.WORKFLOW]);

    const write = await request(app).post(path("/flows")).send({});
    const read = await request(app).get(path("/flows"));
    const head = await request(app).head(path("/flows"));

    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe("ORG_READ_ONLY");
    expect(read.status).toBe(200);
    expect(head.status).toBe(200);
  });

  it("checks the access mode before the module", async () => {
    const app = gatedApp(ACCESS_MODE.READ_ONLY, [MODULE_KEY.IAM]);

    const response = await request(app).delete(path("/flows/1"));

    expect(response.body.error.code).toBe("ORG_READ_ONLY");
  });

  it("fails closed with 500 for a tenant path that no manifest owns", async () => {
    const app = gatedApp(ACCESS_MODE.FULL, [MODULE_KEY.IAM, MODULE_KEY.WORKFLOW]);

    const response = await request(app).get(path("/forgotten"));

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL");
  });

  it("allows only the exact me/config path without an owner module", async () => {
    const app = gatedApp(ACCESS_MODE.FULL, [MODULE_KEY.IAM]);

    const allowed = await request(app).get(path("/me/config"));
    const deeper = await request(app).get(path("/me/config/extra"));
    const sibling = await request(app).get(path("/me/other"));

    expect(allowed.status).toBe(200);
    expect(deeper.status).toBe(500);
    expect(sibling.status).toBe(500);
  });
});
