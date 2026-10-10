import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  registerModel,
  SCHEMA_OPTIONS,
  versionField,
} from "../kernel/db/index.js";

export const PLATFORM_PROBE = "PlatformProbe";
export const TENANT_PROBE = "TenantProbe";

/** A minimal versioned record, enough to prove writes, rollbacks and concurrency. */
export interface ProbeDocument {
  probeId: string;
  label: string;
  /** Set on TENANT_PROBE only: the tenant plugin stamps it from the request context. */
  organizationId?: string;
  /** Limited to PROBE_KINDS by the schema, so tests can prove update validators run. */
  kind?: string;
  version: number;
}

export const PROBE_KINDS = ["STANDARD", "SPECIAL"] as const;

function buildProbeSchema(options: { organizationOwned: boolean }): Schema {
  const schema = new Schema(
    {
      ...domainIdField("probeId"),
      ...(options.organizationOwned
        ? { organizationId: { type: String, required: true, immutable: true } }
        : {}),
      label: { type: String, required: true },
      kind: { type: String, enum: PROBE_KINDS },
      ...versionField,
      ...auditFields,
    },
    SCHEMA_OPTIONS,
  );
  if (options.organizationOwned) schema.index({ organizationId: 1, probeId: 1 });
  return schema;
}

/** One probe model per database, so one transaction can touch both. Call once per test file. */
export function registerProbeModels(): void {
  registerModel({
    modelName: PLATFORM_PROBE,
    collectionName: "platform_probes",
    database: DATABASE_KIND.PLATFORM,
    schema: buildProbeSchema({ organizationOwned: false }),
    tenancy: MODEL_TENANCY.NONE,
  });
  registerModel({
    modelName: TENANT_PROBE,
    collectionName: "tenant_probes",
    database: DATABASE_KIND.TENANT,
    schema: buildProbeSchema({ organizationOwned: true }),
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
