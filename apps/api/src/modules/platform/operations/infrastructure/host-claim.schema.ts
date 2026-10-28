import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const HOST_CLAIM_MODEL_NAME = "HostClaim";
export const HOST_CLAIM_COLLECTION_NAME = "host_claims";

export interface HostClaimDocument {
  hostClaimId: string;
  hostname: string;
  organizationId: string;
  siteDomainId: string;
  enabled: boolean;
  generation: number;
  quarantineUntil: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/**
 * Platform routing data (tenancy NONE): the only place a host name is unique across organizations.
 * It stores no tenant content, so it never needs the tenant plugin; `organizationId` is a reference,
 * not a tenancy column (plan 4.2 decision 4).
 */
export const hostClaimSchema = new Schema<HostClaimDocument>(
  {
    ...domainIdField("hostClaimId"),
    hostname: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true },
    siteDomainId: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: true },
    generation: { type: Number, required: true, min: 1 },
    quarantineUntil: { type: Date, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

hostClaimSchema.index({ hostname: 1 }, { unique: true });
hostClaimSchema.index({ siteDomainId: 1 }, { unique: true });
hostClaimSchema.index({ enabled: 1, quarantineUntil: 1 });
