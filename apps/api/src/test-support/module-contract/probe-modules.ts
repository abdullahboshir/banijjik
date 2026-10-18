import {
  DATABASE_KIND,
  EVENT_TYPE,
  MODEL_TENANCY,
  MODULE_CLASS,
  MODULE_KEY,
  OFFERING_KIND,
  PERMISSION_KEY,
  SURFACE,
  type ModuleClass,
  type ModuleKey,
  type ModuleManifest,
  type OfferingKind,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Router } from "express";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  models,
  registerModel,
  SCHEMA_OPTIONS,
  versionField,
} from "../../kernel/db/index.js";
import { sendData } from "../../kernel/http/index.js";
import { defineModule } from "../../kernel/modules/index.js";
import { withOrganizationContext } from "../organization-context.js";
import type { ModuleDataAccess } from "./contract-types.js";

interface ProbeProfile {
  readonly key: ModuleKey;
  readonly moduleClass: ModuleClass;
  readonly tenantCanDisable: boolean;
  readonly dependsOn: readonly ModuleKey[];
  readonly providesKinds: readonly OfferingKind[];
  readonly requiresAnyKind: readonly OfferingKind[];
}

/**
 * Three probe modules registered only by the contract tests. They stand in for the modules that
 * do not exist yet and cover every off-path of 10-MODULE-CATALOG section 11:
 * - `sales` is CORE and provides the PRODUCT kind (standing in for a CORE module; `catalog` is real since card 3.2a);
 * - `website` is OPTIONAL and is the dependency of `workflow`;
 * - `workflow` is OPTIONAL, tenant-disableable, needs `website` and the PRODUCT kind.
 * Their keys are catalogue keys no real module uses yet; change them when that module arrives (`sales` arrives with card 3.5).
 */
const PROBE_PROFILES: readonly ProbeProfile[] = [
  {
    key: MODULE_KEY.SALES,
    moduleClass: MODULE_CLASS.CORE,
    tenantCanDisable: false,
    dependsOn: [],
    providesKinds: [OFFERING_KIND.PRODUCT],
    requiresAnyKind: [],
  },
  {
    key: MODULE_KEY.WEBSITE,
    moduleClass: MODULE_CLASS.OPTIONAL,
    tenantCanDisable: false,
    dependsOn: [],
    providesKinds: [],
    requiresAnyKind: [],
  },
  {
    key: MODULE_KEY.WORKFLOW,
    moduleClass: MODULE_CLASS.OPTIONAL,
    tenantCanDisable: true,
    dependsOn: [MODULE_KEY.WEBSITE],
    providesKinds: [],
    requiresAnyKind: [OFFERING_KIND.PRODUCT],
  },
];

function toPascalCase(key: string): string {
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/** One location-overridable setting on the website probe, so the module-off suite can hide it. */
function probeSettings(key: ModuleKey): ModuleManifest["settings"] {
  if (key !== MODULE_KEY.WEBSITE) return [];
  return [
    {
      settingKey: "website.probeEnabled",
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: true,
      isClientVisible: false,
    },
  ];
}

function routePrefix(key: ModuleKey): string {
  return `/contract-probe/${key}`;
}

export function probeModelName(key: ModuleKey): string {
  return `ContractProbe${toPascalCase(key)}`;
}

function buildProbeManifest(profile: ProbeProfile): ModuleManifest {
  const { key } = profile;
  return defineModule({
    key,
    path: `capability/${key}`,
    moduleClass: profile.moduleClass,
    dependsOn: profile.dependsOn,
    providesKinds: profile.providesKinds,
    requiresAnyKind: profile.requiresAnyKind,
    tenantCanDisable: profile.tenantCanDisable,
    permissions: [],
    routes: { admin: [`/orgs/:organizationId${routePrefix(key)}`] },
    menu: [
      {
        menuKey: `contract.${key}`,
        surface: SURFACE.ADMIN,
        groupKey: "settings",
        labelTermKey: `menu.contract.${key}`,
        path: routePrefix(key),
        iconKey: "probe",
        permissionKey: PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
        order: 1,
      },
    ],
    settings: probeSettings(key),
    customFieldEntities: [`contract_${key}`],
    botTools: [`contract.${key}.lookup`],
    storefrontSections: [`contract-${key}-banner`],
    events: { emits: [], consumes: [EVENT_TYPE.USER_REGISTERED] },
    limitKeys: [],
    sequenceKeys: [],
  });
}

export const CONTRACT_PROBE_MANIFESTS: readonly ModuleManifest[] =
  PROBE_PROFILES.map(buildProbeManifest);

function buildProbeSchema(): Schema {
  const schema = new Schema(
    {
      ...domainIdField("probeId"),
      organizationId: { type: String, required: true, immutable: true },
      label: { type: String, required: true },
      ...versionField,
      ...auditFields,
    },
    SCHEMA_OPTIONS,
  );
  schema.index({ organizationId: 1, probeId: 1 });
  return schema;
}

/** One tenant model per probe module, so "the module's data" is something the suite can count. Call once per test file. */
export function registerContractProbeModels(): void {
  for (const { key } of PROBE_PROFILES) {
    registerModel({
      modelName: probeModelName(key),
      collectionName: `contract_probe_${key.replaceAll("-", "_")}`,
      database: DATABASE_KIND.TENANT,
      schema: buildProbeSchema(),
      tenancy: MODEL_TENANCY.ORGANIZATION,
    });
  }
}

function probeDocuments(modelName: string) {
  return models({}).get<{ probeId: string; label: string }>(modelName);
}

/**
 * The routes of the probe modules. GET answers; POST writes one document, so a gate that lets a
 * request through to a disabled module changes the module's data and the suite sees it.
 */
export function buildContractProbeRouter(): Router {
  const router = Router({ mergeParams: true });
  for (const { key } of PROBE_PROFILES) {
    router.get(routePrefix(key), (_request, response) => sendData(response, { module: key }));
    router.post(routePrefix(key), async (_request, response) => {
      await probeDocuments(probeModelName(key)).create({ probeId: newId(), label: "created" });
      sendData(response, { module: key }, { status: 201 });
    });
  }
  return router;
}

/** Data access for the probe modules: each owns the one model registered for it. */
export const contractProbeData: ModuleDataAccess = {
  modelNames: (moduleKey) =>
    PROBE_PROFILES.some((profile) => profile.key === moduleKey) ? [probeModelName(moduleKey)] : [],
  seed: (organizationId, modelName) =>
    withOrganizationContext(organizationId, async () => {
      await probeDocuments(modelName).create({ probeId: newId(), label: "seed" });
    }),
  count: (organizationId, modelName) =>
    withOrganizationContext(organizationId, () => probeDocuments(modelName).countDocuments({})),
};
