import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { CONTACT_COLLECTION_NAME, CONTACT_MODEL_NAME, contactSchema } from "./contact.schema.js";
import {
  CUSTOMER_ACCOUNT_COLLECTION_NAME,
  CUSTOMER_ACCOUNT_MODEL_NAME,
  CUSTOMER_SESSION_COLLECTION_NAME,
  CUSTOMER_SESSION_MODEL_NAME,
  CUSTOMER_SMS_SENT_COLLECTION_NAME,
  CUSTOMER_SMS_SENT_MODEL_NAME,
  customerAccountSchema,
  customerSessionSchema,
  customerSmsSentSchema,
  OTP_CHALLENGE_COLLECTION_NAME,
  OTP_CHALLENGE_MODEL_NAME,
  otpChallengeSchema,
  SMS_TEST_MESSAGE_COLLECTION_NAME,
  SMS_TEST_MESSAGE_MODEL_NAME,
  smsTestMessageSchema,
} from "./customer-account.schema.js";

const CUSTOMER_LOGIN_MODELS = [
  [CUSTOMER_ACCOUNT_MODEL_NAME, CUSTOMER_ACCOUNT_COLLECTION_NAME, customerAccountSchema],
  [CUSTOMER_SESSION_MODEL_NAME, CUSTOMER_SESSION_COLLECTION_NAME, customerSessionSchema],
  [OTP_CHALLENGE_MODEL_NAME, OTP_CHALLENGE_COLLECTION_NAME, otpChallengeSchema],
  [SMS_TEST_MESSAGE_MODEL_NAME, SMS_TEST_MESSAGE_COLLECTION_NAME, smsTestMessageSchema],
  [CUSTOMER_SMS_SENT_MODEL_NAME, CUSTOMER_SMS_SENT_COLLECTION_NAME, customerSmsSentSchema],
] as const;

/**
 * Contacts live in the tenant database and are filtered by organization, never by location (09
 * section 5.1). So do the customer sign-in models: a customer belongs to one business (ADR-119).
 */
export function registerContactModels(): void {
  registerModel({
    modelName: CONTACT_MODEL_NAME,
    collectionName: CONTACT_COLLECTION_NAME,
    database: DATABASE_KIND.TENANT,
    schema: contactSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  for (const [modelName, collectionName, schema] of CUSTOMER_LOGIN_MODELS) {
    registerModel({
      modelName,
      collectionName,
      database: DATABASE_KIND.TENANT,
      schema,
      tenancy: MODEL_TENANCY.ORGANIZATION,
    });
  }
}
