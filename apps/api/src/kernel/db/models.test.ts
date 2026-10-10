import { DATABASE_KIND } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PLATFORM_PROBE,
  registerProbeModels,
  TENANT_PROBE,
  type ProbeDocument,
} from "../../test-support/probe-models.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { AppError } from "../http/app-error.js";
import type { DatabaseConnections } from "./database-connections.js";
import { addGlobalSchemaPlugin, registerModel } from "./model-registry.js";
import { initializeModels, models } from "./models.js";

const TENANT_ONLY_FIELD = "tenantOnlyMarker";

// Added before any model compiles, as the tenant plugin of card 1.3 will be.
addGlobalSchemaPlugin((schema) => schema.add({ [TENANT_ONLY_FIELD]: String }), {
  database: DATABASE_KIND.TENANT,
});
registerProbeModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

describe("models(context)", () => {
  it("resolves a PLATFORM model on the platform database", async () => {
    const Platform = models({}).get<ProbeDocument>(PLATFORM_PROBE);

    await Platform.create({ probeId: newId(), label: "platform" });

    expect(Platform.db.db?.databaseName).toBe(connections.platform.db?.databaseName);
    expect(await connections.platform.db?.collection("platform_probes").countDocuments()).toBe(1);
  });

  it("resolves a TENANT model on the tenant database", async () => {
    const organizationId = newId();
    const Tenant = models({ organizationId }).get<ProbeDocument>(TENANT_PROBE);

    await Tenant.create({ probeId: newId(), label: "tenant" });

    expect(Tenant.db.db?.databaseName).toBe(connections.tenantShared.db?.databaseName);
    expect(await connections.tenantShared.db?.collection("tenant_probes").countDocuments()).toBe(1);
  });

  it("treats a missing deployment as SHARED and compiles each model once", () => {
    const first = models({ organizationId: newId() }).get(TENANT_PROBE);
    const second = models({ organizationId: newId(), deployment: "SHARED" }).get(TENANT_PROBE);

    expect(second).toBe(first);
  });

  it("refuses a DEDICATED tenant until Phase 8", () => {
    const attempt = (): unknown =>
      models({ organizationId: newId(), deployment: "DEDICATED" }).get(TENANT_PROBE);

    expect(attempt).toThrow(AppError);
    expect(attempt).toThrow(/errors\.dedicated_not_supported/);
  });

  it("throws for a model name nobody registered", () => {
    expect(() => models({}).get("MissingModel")).toThrow(/errors\.unknown_model/);
  });
});

describe("registerModel", () => {
  it("throws when the same model name is registered twice", () => {
    const duplicate = (): void =>
      registerModel({
        modelName: PLATFORM_PROBE,
        collectionName: "other",
        database: DATABASE_KIND.PLATFORM,
        schema: new Schema({}),
      });

    expect(duplicate).toThrow(/errors\.duplicate_model/);
  });
});

describe("global schema plugins", () => {
  it("apply to TENANT schemas only", () => {
    const tenantSchema = models({}).get(TENANT_PROBE).schema;
    const platformSchema = models({}).get(PLATFORM_PROBE).schema;

    expect(tenantSchema.path(TENANT_ONLY_FIELD)).toBeDefined();
    expect(platformSchema.path(TENANT_ONLY_FIELD)).toBeUndefined();
  });
});

describe("model registry sealing (J5c)", () => {
  it("throws when a global plugin is added after the first model compiled", () => {
    const lateRegistration = (): void =>
      addGlobalSchemaPlugin((schema) => schema.add({ late: String }), {
        database: DATABASE_KIND.TENANT,
      });

    expect(lateRegistration).toThrow(AppError);
    expect(lateRegistration).toThrow(/errors.model_registry_sealed/);
  });

  it("throws when a new model is registered after the first model compiled", () => {
    const lateModel = (): void =>
      registerModel({
        modelName: "LateModel",
        collectionName: "late_models",
        database: DATABASE_KIND.TENANT,
        schema: new Schema({}),
      });

    expect(lateModel).toThrow(/errors.model_registry_sealed/);
  });
});

describe("schema options", () => {
  it("rejects a field the schema does not declare (strict throw)", async () => {
    const Tenant = models({ organizationId: newId() }).get<ProbeDocument>(TENANT_PROBE);
    const withUnknownField: Record<string, unknown> = {
      probeId: newId(),
      label: "x",
      surprise: true,
    };

    await expect(Tenant.create(withUnknownField)).rejects.toThrow(/surprise/);
  });

  it("stores the explicit version and no __v", async () => {
    const Tenant = models({ organizationId: newId() }).get<ProbeDocument>(TENANT_PROBE);
    const probeId = newId();

    await Tenant.create({ probeId, label: "v" });
    const stored = await Tenant.findOne({ probeId }).lean<Record<string, unknown>>();

    expect(stored?.["version"]).toBe(1);
    expect(stored).not.toHaveProperty("__v");
    expect(stored?.["createdByUserId"]).toBeNull();
    expect(stored?.["createdAt"]).toBeInstanceOf(Date);
  });
});
