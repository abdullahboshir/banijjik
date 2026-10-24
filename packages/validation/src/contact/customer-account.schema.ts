import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import { z } from "zod";
import { versionSchema } from "../organization/organization-fields.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const OTP_CODE_PATTERN = new RegExp(`^[0-9]{${CUSTOMER_OTP_RULES.codeLength}}$`);
const HOST_PATTERN = /^[a-z0-9.-]+(:[0-9]{1,5})?$/i;
const HOST_MAX_LENGTH = 260;

/** Body of `POST …/auth/otp/send`: a phone number in any accepted form; the parsed value is E.164. */
export const customerOtpSendRequestSchema = z.strictObject({ phone: phoneE164Schema });
export type CustomerOtpSendBody = z.output<typeof customerOtpSendRequestSchema>;

/** Body of `POST …/auth/otp/verify`: the phone and exactly the six digits of the code, nothing else. */
export const customerOtpVerifyRequestSchema = z.strictObject({
  phone: phoneE164Schema,
  code: z.string().regex(OTP_CODE_PATTERN),
});
export type CustomerOtpVerifyBody = z.output<typeof customerOtpVerifyRequestSchema>;

/** `?host=` of the public `GET /storefront/resolve`: a host name, optionally with a port. */
export const storefrontResolveQuerySchema = z.object({
  host: z.string().trim().min(1).max(HOST_MAX_LENGTH).regex(HOST_PATTERN),
});

export const storefrontOrganizationParamsSchema = z.object({ organizationId: uuidV7Schema });

/** Body of the block and unblock endpoints: the version the staff member read. */
export const customerAccountBlockRequestSchema = z.strictObject({ version: versionSchema });
export type CustomerAccountBlockBody = z.output<typeof customerAccountBlockRequestSchema>;

/** Body of `POST …/my/account/erase`: proof of ownership via OTP challenge and code (card M.7). */
export const customerAccountEraseRequestSchema = z.strictObject({
  challengeId: uuidV7Schema,
  code: z.string().regex(OTP_CODE_PATTERN),
});
export type CustomerAccountEraseBody = z.output<typeof customerAccountEraseRequestSchema>;
