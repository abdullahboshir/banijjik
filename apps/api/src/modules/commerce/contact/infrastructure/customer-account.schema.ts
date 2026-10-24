import { CUSTOMER_ACCOUNT_STATUS, type CustomerAccountStatus } from "@banijjik/contracts/contact";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const CUSTOMER_ACCOUNT_MODEL_NAME = "CustomerAccount";
export const CUSTOMER_ACCOUNT_COLLECTION_NAME = "customer_accounts";
export const CUSTOMER_SESSION_MODEL_NAME = "CustomerSession";
export const CUSTOMER_SESSION_COLLECTION_NAME = "customer_sessions";
export const OTP_CHALLENGE_MODEL_NAME = "OtpChallenge";
export const OTP_CHALLENGE_COLLECTION_NAME = "otp_challenges";
export const SMS_TEST_MESSAGE_MODEL_NAME = "SmsTestMessage";
export const SMS_TEST_MESSAGE_COLLECTION_NAME = "sms_test_messages";

const SECONDS_PER_DAY = 24 * 60 * 60;

export interface CustomerAccountDocument {
  customerAccountId: string;
  organizationId: string;
  contactId: string;
  phoneE164: string;
  status: CustomerAccountStatus;
  verifiedAt: Date;
  lastLoginAt: Date;
  blockedAt?: Date;
  blockedByUserId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const customerAccountSchema = new Schema<CustomerAccountDocument>(
  {
    ...domainIdField("customerAccountId"),
    organizationId: { type: String, required: true, immutable: true },
    contactId: { type: String, required: true, immutable: true },
    phoneE164: { type: String, required: true, immutable: true },
    status: { type: String, required: true, enum: Object.values(CUSTOMER_ACCOUNT_STATUS) },
    verifiedAt: { type: Date, required: true },
    lastLoginAt: { type: Date, required: true },
    blockedAt: { type: Date },
    blockedByUserId: { type: String },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

customerAccountSchema.index({ organizationId: 1, customerAccountId: 1 }, { unique: true });
// One login per contact and one per phone in a business (ADR-119).
customerAccountSchema.index({ organizationId: 1, contactId: 1 }, { unique: true });
customerAccountSchema.index({ organizationId: 1, phoneE164: 1 }, { unique: true });

export interface CustomerSessionDocument {
  customerSessionId: string;
  organizationId: string;
  customerAccountId: string;
  refreshTokenHash: string;
  previousRefreshTokenHash?: string;
  expiresAt: Date;
  lastUsedAt: Date;
  userAgentSummary?: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const customerSessionSchema = new Schema<CustomerSessionDocument>(
  {
    ...domainIdField("customerSessionId"),
    organizationId: { type: String, required: true, immutable: true },
    customerAccountId: { type: String, required: true, immutable: true },
    refreshTokenHash: { type: String, required: true },
    previousRefreshTokenHash: { type: String },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    userAgentSummary: { type: String },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

customerSessionSchema.index({ organizationId: 1, customerSessionId: 1 }, { unique: true });
customerSessionSchema.index({ organizationId: 1, refreshTokenHash: 1 }, { unique: true });
customerSessionSchema.index(
  { organizationId: 1, previousRefreshTokenHash: 1 },
  { partialFilterExpression: { previousRefreshTokenHash: { $type: "string" } } },
);
customerSessionSchema.index({ organizationId: 1, customerAccountId: 1 });
// MongoDB removes a session once it has expired.
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface OtpChallengeDocument {
  otpChallengeId: string;
  organizationId: string;
  phoneE164: string;
  codeHash: string;
  codeCiphertext?: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  purpose: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const otpChallengeSchema = new Schema<OtpChallengeDocument>(
  {
    ...domainIdField("otpChallengeId"),
    organizationId: { type: String, required: true, immutable: true },
    phoneE164: { type: String, required: true, immutable: true },
    codeHash: { type: String, required: true, immutable: true },
    codeCiphertext: { type: String },
    attempts: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
    purpose: { type: String, required: true, default: "SIGN_IN" },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

otpChallengeSchema.index({ organizationId: 1, otpChallengeId: 1 }, { unique: true });
// One live challenge per phone: a new send replaces the previous one.
otpChallengeSchema.index({ organizationId: 1, phoneE164: 1 }, { unique: true });
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface SmsTestMessageDocument {
  smsTestMessageId: string;
  organizationId: string;
  phoneE164: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

/** The "test inbox" driver writes messages here so tests can read them. It is empty wherever a real driver is used. */
export const smsTestMessageSchema = new Schema<SmsTestMessageDocument>(
  {
    ...domainIdField("smsTestMessageId"),
    organizationId: { type: String, required: true, immutable: true },
    phoneE164: { type: String, required: true },
    text: { type: String, required: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

smsTestMessageSchema.index({ organizationId: 1, smsTestMessageId: 1 }, { unique: true });
smsTestMessageSchema.index({ organizationId: 1, phoneE164: 1, createdAt: -1 });
smsTestMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: SECONDS_PER_DAY });
