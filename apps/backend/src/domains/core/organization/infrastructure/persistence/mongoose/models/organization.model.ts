import mongoose, { Schema, Document } from "mongoose";
import {
  ORGANIZATION_INDUSTRY_ENUM,
  ORGANIZATION_LEGAL_TYPE_ENUM,
  ORGANIZATION_NATURE_ENUM,
  ORGANIZATION_NATURE,
  ORGANIZATION_STATUS_ENUM,
  ORGANIZATION_STATUS,
  DEPLOYMENT_TYPE_ENUM,
  DEPLOYMENT_TYPE,
  ORGANIZATION_CURRENCY_ENUM,
  ORGANIZATION_CURRENCY,
  ORGANIZATION_LANGUAGE_ENUM,
  ORGANIZATION_LANGUAGE,
  ORGANIZATION_STORAGE_PROVIDER_ENUM,
  ORGANIZATION_STORAGE_PROVIDER,
} from "@banijjik/contracts";

export interface IOrganizationDocument extends Document {
  organizationId: string;
  name: string;
  slug: string;
  industry: (typeof ORGANIZATION_INDUSTRY_ENUM)[number];
  legalType: (typeof ORGANIZATION_LEGAL_TYPE_ENUM)[number];
  nature: (typeof ORGANIZATION_NATURE_ENUM)[number];
  status: (typeof ORGANIZATION_STATUS_ENUM)[number];
  email: string;
  phone?: string;
  supportPhone?: string;
  website?: string;
  address?: string;
  establishedDate?: Date;
  localization: {
    currency: (typeof ORGANIZATION_CURRENCY_ENUM)[number];
    language: (typeof ORGANIZATION_LANGUAGE_ENUM)[number];
    timezone: string;
    dateFormat: string;
  };
  deployment: {
    type: (typeof DEPLOYMENT_TYPE_ENUM)[number];
    customDomain?: string;
    databaseUri?: string;
    serverRegion?: string;
    dbCluster?: string;
    customEnv?: Record<string, any>;
    storageConfig?: {
      provider: (typeof ORGANIZATION_STORAGE_PROVIDER_ENUM)[number];
      bucket?: string;
      region?: string;
    };
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganizationDocument>(
  {
    organizationId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    industry: {
      type: String,
      enum: ORGANIZATION_INDUSTRY_ENUM,
      required: true,
    },
    legalType: {
      type: String,
      enum: ORGANIZATION_LEGAL_TYPE_ENUM,
      required: true,
    },
    nature: {
      type: String,
      enum: ORGANIZATION_NATURE_ENUM,
      required: true,
      default: ORGANIZATION_NATURE.SERVICE,
    },
    status: {
      type: String,
      enum: ORGANIZATION_STATUS_ENUM,
      required: true,
      default: ORGANIZATION_STATUS.PENDING,
    },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    supportPhone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String },
    establishedDate: { type: Date },
    localization: {
      currency: {
        type: String,
        enum: ORGANIZATION_CURRENCY_ENUM,
        default: ORGANIZATION_CURRENCY.BDT,
      },
      language: {
        type: String,
        enum: ORGANIZATION_LANGUAGE_ENUM,
        default: ORGANIZATION_LANGUAGE.EN,
      },
      timezone: { type: String, default: "Asia/Dhaka" },
      dateFormat: { type: String, default: "DD/MM/YYYY" },
    },
    deployment: {
      type: {
        type: String,
        enum: DEPLOYMENT_TYPE_ENUM,
        default: DEPLOYMENT_TYPE.SHARED,
      },
      customDomain: { type: String, trim: true },
      databaseUri: { type: String, select: false }, // Sensitive data
      serverRegion: { type: String },
      dbCluster: { type: String },
      customEnv: { type: Schema.Types.Mixed },
      storageConfig: {
        provider: {
          type: String,
          enum: ORGANIZATION_STORAGE_PROVIDER_ENUM,
          default: ORGANIZATION_STORAGE_PROVIDER.LOCAL,
        },
        bucket: { type: String },
        region: { type: String },
      },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const OrganizationModel = mongoose.model<IOrganizationDocument>(
  "Organization",
  OrganizationSchema,
);
