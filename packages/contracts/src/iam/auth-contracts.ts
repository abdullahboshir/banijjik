import { defineEnum } from "../define-enum.js";
import type { CurrencyCode } from "../organization/currency-code.js";
import type { PreferredLocale } from "./preferred-locale.js";

/** Actions that need a manager PIN on the same device (11 §9, ADR-121). */
export const APPROVAL_ACTION = defineEnum([
  "DISCOUNT",
  "REFUND",
  "PAYMENT_REVERSAL",
  "PRICE_OVERRIDE",
  "STORE_CREDIT_ADJUSTMENT",
  "ENROLLMENT_REFUND",
  "SESSION_LIMIT_OVERRIDE",
  "RETURN_NOT_RECEIVED",
  "STOCK_ADJUSTMENT",
]);
export type ApprovalAction = (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];

/** Organization setting: a sole OWNER may approve their own request (default true). */
export const IAM_OWNER_SELF_APPROVAL_SETTING_KEY = "iam.approval.ownerSelfApproval";

/** `PUT /orgs/{organizationId}/me/approval-pin`. */
export interface ApprovalPinSetRequest {
  readonly currentPassword: string;
  readonly pin: string;
}

/** `POST /orgs/{organizationId}/approvals`. */
export interface ApprovalGrantRequest {
  readonly action: ApprovalAction;
  readonly subjectKey: string;
  readonly amount?: { readonly amount: number; readonly currency: CurrencyCode };
  readonly locationId: string;
  readonly approverMemberId: string;
  readonly pin: string;
}

/** Answer of a successful PIN check. */
export interface ApprovalGrantResponse {
  readonly approvalToken: string;
  readonly expiresAt: string;
}

/** One member who may approve at the requested location. */
export interface ApproverSummary {
  readonly memberId: string;
  readonly displayName: string;
  readonly hasPin: boolean;
}

/** `POST /auth/register` (14-API.md section 4). At least one of email and phone is required. */
export interface UserRegisterRequest {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  preferredLocale?: PreferredLocale;
}

/** `POST /auth/login`. The identifier is an email or a phone number in any accepted format. */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/** `PATCH /me`. `version` is the value of the last MeResponse (optimistic concurrency). */
export interface MeUpdateRequest {
  name?: string;
  preferredLocale?: PreferredLocale;
  version: number;
}

/** `GET /me` and the body of register, login and `PATCH /me`. Never contains a token or a hash. */
export interface MeResponse {
  userId: string;
  name: string;
  email?: string;
  phoneE164?: string;
  preferredLocale: PreferredLocale;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  version: number;
}
