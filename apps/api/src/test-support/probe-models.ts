import { DATABASE_KIND } from "@banijjik/contracts";
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
  /** Limited to PROBE_KINDS by the schema, so tests can prove update validators run. */
  kind?: string;
  version: number;
}

export const PROBE_KINDS = ["STANDARD", "SPECIAL"] as const;

function buildProbeSchema(): Schema {
  return new Schema(
    {
      ...domainIdField("probeId"),
      label: { type: String, required: true },
      kind: { type: String, enum: PROBE_KINDS },
      ...versionField,
      ...auditFields,
    },
    SCHEMA_OPTIONS,
  );
}

/** One probe model per database, so one transaction can touch both. Call once per test file. */
export function registerProbeModels(): void {
  registerModel({
    modelName: PLATFORM_PROBE,
    collectionName: "platform_probes",
    database: DATABASE_KIND.PLATFORM,
    schema: buildProbeSchema(),
  });
  registerModel({
    modelName: TENANT_PROBE,
    collectionName: "tenant_probes",
    database: DATABASE_KIND.TENANT,
    schema: buildProbeSchema(),
  });
}
