import {
  INDUSTRY_TEMPLATE_KEY_PATTERN,
  INDUSTRY_TEMPLATE_STATUS,
  type IndustryTemplateConfiguration,
  type IndustryTemplateKey,
  type IndustryTemplateStatus,
  type LocalizedText,
  type ModuleKey,
  type OfferingKind,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const INDUSTRY_TEMPLATE_MODEL_NAME = "IndustryTemplate";
export const INDUSTRY_TEMPLATE_COLLECTION_NAME = "industry_templates";

export interface IndustryTemplateDocument {
  industryTemplateId: string;
  industryTemplateKey: IndustryTemplateKey;
  status: IndustryTemplateStatus;
  name: LocalizedText;
  description: LocalizedText;
  iconKey: string;
  enabledKinds: OfferingKind[];
  allowedModuleKeys: ModuleKey[];
  /**
   * Validated by industryTemplateConfigurationSchema before insert. Mixed because cards 2.2 to 2.4
   * own the meaning of terms, fields and settings, and the shape is not a fixed column list.
   */
  configuration: IndustryTemplateConfiguration;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const localizedTextSchema = new Schema(
  {
    bn: { type: String, required: true },
    en: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const industryTemplateSchema = new Schema<IndustryTemplateDocument>(
  {
    ...domainIdField("industryTemplateId"),
    industryTemplateKey: {
      type: String,
      required: true,
      immutable: true,
      match: INDUSTRY_TEMPLATE_KEY_PATTERN,
    },
    status: { type: String, required: true, enum: Object.values(INDUSTRY_TEMPLATE_STATUS) },
    name: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    iconKey: { type: String, required: true },
    enabledKinds: [{ type: String, required: true }],
    allowedModuleKeys: [{ type: String, required: true }],
    configuration: { type: Schema.Types.Mixed, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

industryTemplateSchema.index({ industryTemplateId: 1 }, { unique: true });
industryTemplateSchema.index({ industryTemplateKey: 1 }, { unique: true });
industryTemplateSchema.index({ status: 1, industryTemplateKey: 1 });
