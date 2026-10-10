import { MODEL_TENANCY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels } from "../../test-support/iam-api-harness.js";
import {
  registerAppendOnlyProbeModel,
  registerProbeModels,
} from "../../test-support/probe-models.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { registerTenantNoteModel } from "../../test-support/tenant-probe.js";
import { hasAppendOnlyPlugin } from "./append-only-plugin.js";
import { hasLocationPlugin, hasTenantPlugin } from "../tenancy/apply-tenancy-plugins.js";
import type { DatabaseConnections } from "./database-connections.js";
import { listModelDefinitions } from "./model-registry.js";
import { initializeModels, models } from "./models.js";

// Every model the app registers, plus the test models: a model any later card adds is checked the same way.
registerIamApiModels();
registerProbeModels();
registerAppendOnlyProbeModel();
registerTenantNoteModel();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function tenancyOf(modelName: string): string | undefined {
  return listModelDefinitions().find((definition) => definition.modelName === modelName)?.tenancy;
}

describe("model registry meta-test", () => {
  it("has registered the models of the app", () => {
    expect(listModelDefinitions().length).toBeGreaterThanOrEqual(9);
  });

  it("makes every model declare a known tenancy", () => {
    for (const definition of listModelDefinitions()) {
      expect(Object.values(MODEL_TENANCY), definition.modelName).toContain(definition.tenancy);
    }
  });

  it("puts the tenant plugin on every ORGANIZATION* model and on no other", () => {
    for (const definition of listModelDefinitions()) {
      const compiled = models({}).get(definition.modelName).schema;
      const isOrganizationOwned = definition.tenancy !== MODEL_TENANCY.NONE;
      expect(hasTenantPlugin(compiled), definition.modelName).toBe(isOrganizationOwned);
    }
  });

  it("puts the location plugin on every ORGANIZATION_AND_LOCATION model and on no other", () => {
    for (const definition of listModelDefinitions()) {
      const compiled = models({}).get(definition.modelName).schema;
      const isLocationOwned = definition.tenancy === MODEL_TENANCY.ORGANIZATION_AND_LOCATION;
      expect(hasLocationPlugin(compiled), definition.modelName).toBe(isLocationOwned);
    }
  });

  it("puts the append-only plugin on every appendOnly model and on no other", () => {
    for (const definition of listModelDefinitions()) {
      const compiled = models({}).get(definition.modelName).schema;
      expect(hasAppendOnlyPlugin(compiled), definition.modelName).toBe(
        definition.appendOnly === true,
      );
    }
    expect(listModelDefinitions().some((definition) => definition.modelName === "AuditLog")).toBe(
      true,
    );
  });

  it("marks the audit log append-only", () => {
    const audit = listModelDefinitions().find((definition) => definition.modelName === "AuditLog");
    expect(audit?.appendOnly).toBe(true);
    expect(audit?.tenancy).toBe("ORGANIZATION");
  });

  it("classifies the models of cards 1.1 and 1.2 as planned", () => {
    expect(tenancyOf("User")).toBe("NONE");
    expect(tenancyOf("RefreshSession")).toBe("NONE");
    expect(tenancyOf("PlatformOperator")).toBe("NONE");
    expect(tenancyOf("RateLimitCounter")).toBe("NONE");
    expect(tenancyOf("Organization")).toBe("NONE");
    expect(tenancyOf("Location")).toBe("ORGANIZATION");
    expect(tenancyOf("Member")).toBe("ORGANIZATION");
    expect(tenancyOf("Role")).toBe("ORGANIZATION");
    expect(tenancyOf("Sequence")).toBe("ORGANIZATION");
  });
});
