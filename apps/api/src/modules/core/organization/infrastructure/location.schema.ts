import {
  LOCATION_STATUS,
  LOCATION_TYPE,
  type LocationStatus,
  type LocationType,
  type PostalAddress,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const LOCATION_MODEL_NAME = "Location";
export const LOCATION_COLLECTION_NAME = "locations";

export interface LocationDocument {
  locationId: string;
  organizationId: string;
  name: string;
  locationType: LocationType;
  isDefault: boolean;
  status: LocationStatus;
  address?: PostalAddress;
  phoneE164?: string;
  timezone?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const addressSchema = new Schema<PostalAddress>(
  {
    line1: { type: String },
    area: { type: String },
    thana: { type: String },
    district: { type: String },
    postalCode: { type: String },
  },
  SUB_SCHEMA_OPTIONS,
);

export const locationSchema = new Schema<LocationDocument>(
  {
    ...domainIdField("locationId"),
    organizationId: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    locationType: { type: String, required: true, enum: Object.values(LOCATION_TYPE) },
    isDefault: { type: Boolean, required: true },
    status: { type: String, required: true, enum: Object.values(LOCATION_STATUS) },
    address: { type: addressSchema },
    phoneE164: { type: String },
    timezone: { type: String },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

locationSchema.index({ organizationId: 1, locationId: 1 }, { unique: true });
locationSchema.index({ organizationId: 1, name: 1 }, { unique: true });
// Exactly one default location per organization (09 section 4.3).
locationSchema.index(
  { organizationId: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);
