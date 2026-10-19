/**
 * IAM approval vocabulary (card 3.4b). Root index is at the line cap, so this lives on the
 * `@banijjik/contracts/iam` subpath (same pattern as catalog and contact).
 */
export { APPROVAL_ACTION, IAM_OWNER_SELF_APPROVAL_SETTING_KEY } from "./auth-contracts.js";
export type {
  ApprovalAction,
  ApprovalGrantRequest,
  ApprovalGrantResponse,
  ApprovalPinSetRequest,
  ApproverSummary,
} from "./auth-contracts.js";
