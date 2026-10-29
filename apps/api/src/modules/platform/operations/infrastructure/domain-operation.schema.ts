import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import {
  DOMAIN_OPERATION_ACTION,
  DOMAIN_OPERATION_STATE,
  type DomainOperationAction,
  type DomainOperationState,
} from "../domain/domain-operation.entity.js";

export const DOMAIN_OPERATION_MODEL_NAME = "DomainOperation";
export const DOMAIN_OPERATION_COLLECTION_NAME = "domain_operations";

export interface DomainOperationDocument {
  domainOperationId: string;
  organizationId: string;
  siteDomainId: string;
  generation: number;
  action: DomainOperationAction;
  providerHostnameId: string | null;
  state: DomainOperationState;
  nextAttemptAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const domainOperationSchema = new Schema<DomainOperationDocument>(
  {
    ...domainIdField("domainOperationId"),
    organizationId: { type: String, required: true },
    siteDomainId: { type: String, required: true },
    generation: { type: Number, required: true, min: 1 },
    action: { type: String, required: true, enum: Object.values(DOMAIN_OPERATION_ACTION) },
    providerHostnameId: { type: String, default: null },
    state: { type: String, required: true, enum: Object.values(DOMAIN_OPERATION_STATE) },
    nextAttemptAt: { type: Date, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

domainOperationSchema.index(
  { organizationId: 1, siteDomainId: 1, generation: 1, action: 1 },
  { unique: true },
);
domainOperationSchema.index({ siteDomainId: 1, generation: 1, action: 1 });
