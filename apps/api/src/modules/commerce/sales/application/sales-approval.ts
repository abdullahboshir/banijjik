import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { ApprovalRequired, Money } from "@banijjik/contracts/pricing";
import type { OrderApproval } from "@banijjik/contracts/sales";
import { INSTANT_ORDER_APPROVAL_SUBJECT, orderApprovalSubject } from "@banijjik/contracts/sales";
import type { OrderId } from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";
import type { SalesApprovalVerifier } from "./ports/sales-ports.js";

function approvalRequiredError(): AppError {
  return new AppError({
    code: ERROR_CODE.APPROVAL_REQUIRED,
    messageKey: "errors.approval_required",
    details: { action: APPROVAL_ACTION.DISCOUNT },
  });
}

/**
 * The discount approval of one order (ADR-121, ADR-131). Returns the approval to store, or
 * `null` when nobody approved because the quote asked for none or the caller is an exempt OWNER.
 * `amount` is the manual discount the quote granted; the token must cover it, so a token given
 * for a smaller discount never approves a bigger one. `consume` must run inside the order's
 * transaction. Instant sales share `order:instant` because their order does not exist when the
 * token is requested; the amount binding is what keeps one token to one sale.
 */
export async function resolveApproval(input: {
  readonly approvalsRequired: readonly ApprovalRequired[];
  readonly orderId: OrderId | null;
  readonly instant: boolean;
  readonly ownerExempt: boolean;
  readonly approvalToken: string | undefined;
  readonly amount: Money;
  readonly approvals: SalesApprovalVerifier;
}): Promise<OrderApproval | null> {
  if (input.approvalsRequired.length === 0 || input.ownerExempt) return null;
  if (input.approvalToken === undefined) throw approvalRequiredError();
  const subjectKey = input.instant
    ? INSTANT_ORDER_APPROVAL_SUBJECT
    : orderApprovalSubject(input.orderId ?? "");
  const consumed = await input.approvals.consume(input.approvalToken, {
    action: APPROVAL_ACTION.DISCOUNT,
    subjectKey,
    amount: { amount: input.amount.amount, currency: input.amount.currency },
  });
  return {
    approverMemberId: consumed.approverMemberId,
    approvedAt: consumed.approvedAt.toISOString(),
    action: APPROVAL_ACTION.DISCOUNT,
  };
}
