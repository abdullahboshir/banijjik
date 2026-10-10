import {
  COUNTRY_CODE,
  CURRENCY_CODE,
  ORGANIZATION_DEPLOYMENT,
  ORGANIZATION_STATUS,
  PREFERRED_LOCALE,
  type CountryCode,
  type CurrencyCode,
  type IndustryTemplateKey,
  type OrganizationDeployment,
  type OrganizationProfileFields,
  type OrganizationStatus,
  type PreferredLocale,
  INDUSTRY_TEMPLATE_KEY,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import { addressSchema } from "./location.schema.js";

export const ORGANIZATION_MODEL_NAME = "Organization";
export const ORGANIZATION_COLLECTION_NAME = "organizations";

/** The stored shape of an organization. Profile, custom fields and the dedicated-database reference arrive with the cards that use them. */
export interface OrganizationDocument {
  organizationId: string;
  slug: string;
  name: string;
  industryTemplateKey: IndustryTemplateKey;
  ownerUserId: string;
  status: OrganizationStatus;
  deployment: OrganizationDeployment;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  timezone: string;
  defaultLocale: PreferredLocale;
  /** Missing on organizations created before card 1.7b: read as an empty profile. */
  profile?: OrganizationProfileFields;
  configVersion: number;
  rolesVersion: number;
  /** Guard counter that serializes limit-checked creates, see OrganizationLimitLock. Not part of any cache key. */
  limitWriteVersion?: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const profileSchema = new Schema<OrganizationProfileFields>(
  {
    legalName: { type: String },
    legalType: { type: String },
    phoneE164: { type: String },
    email: { type: String },
    address: { type: addressSchema },
    tradeLicenseNumber: { type: String },
  },
  SUB_SCHEMA_OPTIONS,
);

export const organizationSchema = new Schema<OrganizationDocument>(
  {
    ...domainIdField("organizationId"),
    slug: { type: String, required: true },
    name: { type: String, required: true },
    industryTemplateKey: {
      type: String,
      required: true,
      enum: Object.values(INDUSTRY_TEMPLATE_KEY),
    },
    ownerUserId: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(ORGANIZATION_STATUS) },
    deployment: { type: String, required: true, enum: Object.values(ORGANIZATION_DEPLOYMENT) },
    countryCode: { type: String, required: true, enum: Object.values(COUNTRY_CODE) },
    currencyCode: { type: String, required: true, enum: Object.values(CURRENCY_CODE) },
    timezone: { type: String, required: true },
    defaultLocale: { type: String, required: true, enum: Object.values(PREFERRED_LOCALE) },
    profile: { type: profileSchema },
    configVersion: { type: Number, required: true },
    rolesVersion: { type: Number, required: true, default: 1 },
    limitWriteVersion: { type: Number, default: 0 },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

organizationSchema.index({ organizationId: 1 }, { unique: true });
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ ownerUserId: 1 });
organizationSchema.index({ status: 1 });
// Back the platform tenant list: newest first, optionally by status, and a name prefix search.
organizationSchema.index({ createdAt: -1, organizationId: -1 });
organizationSchema.index({ status: 1, createdAt: -1, organizationId: -1 });
organizationSchema.index({ name: 1 });
