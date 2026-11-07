import { COLLECTION_CLAIM_STATE, type CollectionClaimState } from "@banijjik/contracts/payment";
import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const COLLECTION_CLAIM_MODEL_NAME = "CollectionClaim";
export const COLLECTION_CLAIM_COLLECTION_NAME = "collection_claims";

export interface CollectionClaimCarrierSubdocument {
  method: "COD_COURIER" | "RIDER_CASH";
  carrierReference: string;
}

export interface CollectionClaimDocument {
  collectionClaimId: string;
  organizationId: string;
  paymentId: string;
  orderId: string;
  carrier: CollectionClaimCarrierSubdocument;
  state: CollectionClaimState;
  generation: number;
  claimedByReference: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const collectionClaimSchema = new Schema<CollectionClaimDocument>(
  {
    ...domainIdField("collectionClaimId"),
    organizationId: { type: String, required: true, immutable: true },
    paymentId: { type: String, required: true, immutable: true },
    orderId: { type: String, required: true, immutable: true },
    carrier: {
      _id: false,
      type: {
        method: { type: String, required: true },
        carrierReference: { type: String, required: true },
      },
      required: true,
    },
    state: {
      type: String,
      enum: Object.values(COLLECTION_CLAIM_STATE),
      required: true,
      default: COLLECTION_CLAIM_STATE.OPEN,
    },
    generation: { type: Number, required: true, default: 1 },
    claimedByReference: { type: String, default: null },
    version: { type: Number, required: true, default: 1 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

collectionClaimSchema.index({ organizationId: 1, paymentId: 1 }, { unique: true });
collectionClaimSchema.index({ organizationId: 1, state: 1, "carrier.method": 1 });
collectionClaimSchema.index({ organizationId: 1, orderId: 1 });
