import { Schema } from "mongoose";
import {
  SMS_PROVIDER,
  SMS_PURPOSE,
  SMS_SOURCE,
  SMS_OUTCOME,
  SMS_FAILURE_REASON,
  type SmsOutcome,
  type SmsProvider,
  type SmsPurpose,
  type SmsSource,
  type SmsFailureReason,
} from "@banijjik/contracts/sms";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { Gateway } from "../domain/gateway.js";

export interface GatewayDocument extends Gateway {
  smsGatewaySettingId?: string;
  platformSmsGatewayId?: string;
  organizationId?: string;
  scopeKey?: string;
  createdAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const adareachSchema = new Schema(
  { username: String, passwordSealed: String, senderId: String },
  SUB_SCHEMA_OPTIONS,
);
const bulksmsbdSchema = new Schema({ apiKeySealed: String, senderId: String }, SUB_SCHEMA_OPTIONS);
const gatewayFields = {
  enabled: { type: Boolean, required: true },
  activeProvider: { type: String, enum: [...Object.values(SMS_PROVIDER), null], default: null },
  adareach: { type: adareachSchema, default: null },
  bulksmsbd: { type: bulksmsbdSchema, default: null },
  ...versionField,
  ...auditFields,
};
export const gatewaySchema = new Schema<GatewayDocument>(
  {
    ...domainIdField("smsGatewaySettingId"),
    organizationId: { type: String, required: true, immutable: true },
    ...gatewayFields,
  },
  SCHEMA_OPTIONS,
);
gatewaySchema.index({ organizationId: 1 }, { unique: true });
export const platformGatewaySchema = new Schema<GatewayDocument>(
  {
    ...domainIdField("platformSmsGatewayId"),
    scopeKey: { type: String, required: true, enum: ["DEFAULT"], immutable: true },
    ...gatewayFields,
  },
  SCHEMA_OPTIONS,
);
platformGatewaySchema.index({ scopeKey: 1 }, { unique: true });

export interface SmsLogDocument {
  smsLogId: string;
  organizationId: string;
  purpose: SmsPurpose;
  phoneLastDigits: string;
  source: SmsSource;
  provider: SmsProvider | null;
  outcome: SmsOutcome;
  failureReason: SmsFailureReason | null;
  providerErrorCode: number | null;
  parts: number | null;
  providerMessageId: string | null;
  businessDate: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}
export const smsLogSchema = new Schema<SmsLogDocument>(
  {
    ...domainIdField("smsLogId"),
    organizationId: { type: String, required: true, immutable: true },
    purpose: { type: String, required: true, enum: Object.values(SMS_PURPOSE) },
    phoneLastDigits: { type: String, required: true, match: /^\d{3}$/ },
    source: { type: String, required: true, enum: Object.values(SMS_SOURCE) },
    provider: { type: String, enum: [...Object.values(SMS_PROVIDER), null], default: null },
    outcome: { type: String, required: true, enum: Object.values(SMS_OUTCOME) },
    failureReason: {
      type: String,
      enum: [...Object.values(SMS_FAILURE_REASON), null],
      default: null,
    },
    providerErrorCode: { type: Number, default: null },
    parts: { type: Number, default: null },
    providerMessageId: { type: String, default: null },
    businessDate: { type: String, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
smsLogSchema.index({ organizationId: 1, createdAt: -1, smsLogId: -1 });
smsLogSchema.index({ organizationId: 1, businessDate: 1, outcome: 1, source: 1 });
smsLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
