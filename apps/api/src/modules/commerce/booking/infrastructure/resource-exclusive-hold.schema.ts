import { Schema } from "mongoose";
import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  registerModel,
  versionField,
} from "../../../../kernel/db/index.js";

export interface ResourceExclusiveHoldDocument {
  resourceExclusiveHoldId: string;
  organizationId: string;
  locationId: string;
  enrollmentId: string;
  resourceId: string;
  startsOn: string;
  endsOn: string | null;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}
export const RESOURCE_EXCLUSIVE_HOLD_MODEL = "ResourceExclusiveHold";
const schema = new Schema<ResourceExclusiveHoldDocument>(
  {
    ...domainIdField("resourceExclusiveHoldId"),
    ...auditFields,
    ...versionField,
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    enrollmentId: { type: String, required: true },
    resourceId: { type: String, required: true },
    startsOn: { type: String, required: true },
    endsOn: { type: String, default: null },
  },
  SCHEMA_OPTIONS,
);
schema.index({ organizationId: 1, resourceExclusiveHoldId: 1 }, { unique: true });
schema.index({ organizationId: 1, resourceId: 1, startsOn: 1, endsOn: 1 });
schema.index({ organizationId: 1, enrollmentId: 1 });

export interface ResourceHoldGuardDocument {
  resourceHoldGuardId: string;
  organizationId: string;
  resourceId: string;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}
export const RESOURCE_HOLD_GUARD_MODEL = "ResourceHoldGuard";
const guardSchema = new Schema<ResourceHoldGuardDocument>(
  {
    ...domainIdField("resourceHoldGuardId"),
    ...auditFields,
    ...versionField,
    organizationId: { type: String, required: true, immutable: true },
    resourceId: { type: String, required: true, immutable: true },
  },
  SCHEMA_OPTIONS,
);
guardSchema.index({ organizationId: 1, resourceId: 1 }, { unique: true });
guardSchema.index({ organizationId: 1, resourceHoldGuardId: 1 }, { unique: true });

export function registerResourceExclusiveHoldModel(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    tenancy: MODEL_TENANCY.ORGANIZATION,
    modelName: RESOURCE_HOLD_GUARD_MODEL,
    collectionName: "resource_hold_guards",
    schema: guardSchema,
  });
  registerModel({
    database: DATABASE_KIND.TENANT,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
    modelName: RESOURCE_EXCLUSIVE_HOLD_MODEL,
    collectionName: "resource_exclusive_holds",
    schema,
  });
}
