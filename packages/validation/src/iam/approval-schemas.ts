import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const SUBJECT_KEY_MAX_LENGTH = 200;

/** 4–8 digits only (ADR-121). */
export const approvalPinSchema = z
  .string()
  .regex(/^\d{4,8}$/, { message: "validation.approval_pin_digits" });

/** Body of `PUT /orgs/{organizationId}/me/approval-pin`. */
export const approvalPinSetRequestSchema = z.strictObject({
  currentPassword: z.string().min(1).max(200),
  pin: approvalPinSchema,
});
export type ApprovalPinSetBody = z.output<typeof approvalPinSetRequestSchema>;

/** Body of `POST /orgs/{organizationId}/approvals`. */
export const approvalGrantRequestSchema = z.strictObject({
  action: z.enum(APPROVAL_ACTION),
  subjectKey: z.string().trim().min(1).max(SUBJECT_KEY_MAX_LENGTH),
  amount: moneySchema.optional(),
  locationId: uuidV7Schema,
  approverMemberId: uuidV7Schema,
  pin: approvalPinSchema,
});
export type ApprovalGrantBody = z.output<typeof approvalGrantRequestSchema>;

/** Query of `GET /orgs/{organizationId}/approvers`. */
export const approversQuerySchema = z.strictObject({
  locationId: uuidV7Schema,
});
export type ApproversQuery = z.output<typeof approversQuerySchema>;
