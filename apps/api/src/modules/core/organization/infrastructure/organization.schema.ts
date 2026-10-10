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
  type OrganizationStatus,
  type PreferredLocale,
  INDUSTRY_TEMPLATE_KEY,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

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
  configVersion: number;
  rolesVersion: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

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
    configVersion: { type: Number, required: true },
    rolesVersion: { type: Number, required: true, default: 1 },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

organizationSchema.index({ organizationId: 1 }, { unique: true });
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ ownerUserId: 1 });
organizationSchema.index({ status: 1 });
