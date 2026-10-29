import { SITE_DOMAIN_STATUS, type SiteDomainStatus } from "@banijjik/contracts/website";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const SITE_DOMAIN_MODEL_NAME = "SiteDomain";
export const SITE_DOMAIN_COLLECTION_NAME = "site_domains";

export interface DnsInstructionDocument {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
}

export interface SiteDomainDocument {
  siteDomainId: string;
  organizationId: string;
  siteId: string;
  hostname: string;
  status: SiteDomainStatus;
  providerHostnameId: string | null;
  operationGeneration: number;
  nextAttemptAt: Date;
  lastVerifiedAt: Date | null;
  ownershipRecords: DnsInstructionDocument[];
  certificateRecords: DnsInstructionDocument[];
  safeDiagnosticKey: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const dnsInstructionSchema = new Schema<DnsInstructionDocument>(
  {
    type: { type: String, required: true, enum: ["CNAME", "TXT"] },
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const siteDomainSchema = new Schema<SiteDomainDocument>(
  {
    ...domainIdField("siteDomainId"),
    organizationId: { type: String, required: true, immutable: true },
    siteId: { type: String, required: true, immutable: true },
    hostname: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(SITE_DOMAIN_STATUS) },
    providerHostnameId: { type: String, default: null },
    operationGeneration: { type: Number, required: true },
    nextAttemptAt: { type: Date, required: true },
    lastVerifiedAt: { type: Date, default: null },
    ownershipRecords: { type: [dnsInstructionSchema], required: true, default: [] },
    certificateRecords: { type: [dnsInstructionSchema], required: true, default: [] },
    safeDiagnosticKey: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

siteDomainSchema.index({ organizationId: 1, siteDomainId: 1 }, { unique: true });
siteDomainSchema.index({ organizationId: 1, hostname: 1 }, { unique: true });
siteDomainSchema.index({ organizationId: 1, status: 1, nextAttemptAt: 1, siteDomainId: 1 });
