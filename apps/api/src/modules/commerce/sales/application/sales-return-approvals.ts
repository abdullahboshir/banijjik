import { APPROVAL_ACTION, type ApprovalAction } from "@banijjik/contracts/iam";
import type { PaymentApprovalSnapshot } from "@banijjik/contracts/payment";
import type { SalesReturnApprovalRecord } from "../domain/sales-return.record.js";
import { returnApprovalRequired } from "../domain/sales-return-errors.js";
import type { SalesApprovalVerifier } from "./ports/sales-ports.js";
import { orderApprovalSubject } from "@banijjik/contracts/sales";
import type { OrderId } from "@banijjik/ids";
import type { Money } from "@banijjik/contracts/sales";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";

export interface ConsumedReturnApprovals {
  /** The REFUND approval, in the shape the payment refund stores. Null when no refund is due or it is exempt. */
  readonly refund: PaymentApprovalSnapshot | null;
  readonly records: readonly SalesReturnApprovalRecord[];
}

interface ApprovalRequest {
  readonly action: ApprovalAction;
  readonly token: string | undefined;
  readonly orderId: OrderId;
  readonly amount: Money;
}

/**
 * Consumes one token for its own action and subject (plan decision 6, amendment 1). The token is
 * single-use, so it is consumed inside the return's transaction.
 */
async function consumeOne(
  approvals: SalesApprovalVerifier,
  request: ApprovalRequest,
): Promise<SalesReturnApprovalRecord> {
  if (request.token === undefined) throw returnApprovalRequired(request.action);
  const consumed = await approvals.consume(request.token, {
    action: request.action,
    subjectKey: orderApprovalSubject(request.orderId),
    amount: { amount: request.amount.amount, currency: request.amount.currency },
  });
  return {
    action: request.action,
    approvalId: consumed.approvalTokenId,
    approverMemberId: consumed.approverMemberId,
    approvedAt: consumed.approvedAt,
  };
}

/**
 * The refund and not-received approvals a return needs. A refund that the manager exemption
 * skips asks for no token; a not-received line always asks for one.
 */
export async function consumeReturnApprovals(input: {
  readonly approvals: SalesApprovalVerifier;
  readonly orderId: OrderId;
  readonly body: Pick<SalesReturnRequestBody, "approvalTokens">;
  readonly refundDue: Money;
  readonly refundApprovalRequired: boolean;
  readonly notReceivedValue: Money;
  readonly notReceivedApprovalRequired: boolean;
}): Promise<ConsumedReturnApprovals> {
  const tokens = input.body.approvalTokens ?? {};
  const records: SalesReturnApprovalRecord[] = [];
  let refund: PaymentApprovalSnapshot | null = null;
  if (input.refundApprovalRequired) {
    const record = await consumeOne(input.approvals, {
      action: APPROVAL_ACTION.REFUND,
      token: tokens.refund,
      orderId: input.orderId,
      amount: input.refundDue,
    });
    records.push(record);
    refund = {
      approvalId: record.approvalId,
      approverMemberId: record.approverMemberId,
      approvedAt: record.approvedAt.toISOString(),
    };
  }
  if (input.notReceivedApprovalRequired) {
    records.push(
      await consumeOne(input.approvals, {
        action: APPROVAL_ACTION.RETURN_NOT_RECEIVED,
        token: tokens.returnNotReceived,
        orderId: input.orderId,
        amount: input.notReceivedValue,
      }),
    );
  }
  return { refund, records };
}
