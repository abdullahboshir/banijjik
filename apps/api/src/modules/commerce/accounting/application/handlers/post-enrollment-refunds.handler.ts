import { EVENT_TYPE, MODULE_KEY } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
} from "@banijjik/contracts/accounting";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { debit, credit, type DraftJournalLine } from "../../domain/journal-lines.js";
import type { PaymentPostingSnapshot } from "../../domain/posting-rules.js";
import type { EnrollmentPeriodPostingSource } from "../ports/enrollment-posting-source.js";
import type { PaymentPostingSource } from "../ports/payment-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

interface Dependencies {
  payments: PaymentPostingSource;
  enrollments: EnrollmentPeriodPostingSource;
  posting: PostJournalDependencies;
}
export function buildPostEnrollmentRefundsHandler(
  input: Dependencies,
): EventHandler<typeof EVENT_TYPE.PAYMENT_REFUNDED> {
  return {
    handlerKey: "accounting.postEnrollmentRefunds",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.PAYMENT_REFUNDED,
    ordering: "ORDERED",
    streamPrefixes: ["paymentAccount:"],
    async handle(envelope) {
      if (!envelope.organizationId) throw postingSourceMissing("organization");
      const payment = await input.payments.readPayment(envelope.payload.paymentId);
      if (!payment) throw postingSourceMissing("payment");
      const lines = await refundLines(input.enrollments, payment);
      if (lines.length === 0) return;
      await postJournalEntry(input.posting, {
        organizationId: asId<OrganizationId>(envelope.organizationId),
        actorUserId: envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId),
        draft: {
          businessDate: payment.businessDate,
          locationId: payment.locationId,
          sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
          sourceId: payment.paymentId,
          postingKey: POSTING_KEY.enrollment_period_refund_revenue,
          lines,
        },
      });
    },
  };
}
async function refundLines(source: EnrollmentPeriodPostingSource, payment: PaymentPostingSnapshot) {
  const lines: DraftJournalLine[] = [];
  for (const allocation of payment.allocations) {
    if (allocation.requestType !== PAYMENT_REQUEST_TYPE.ENROLLMENT) continue;
    const closed = await source.readRefundClose(allocation.requestId);
    if (!closed) continue;
    if (
      closed.currency !== allocation.amount.currency ||
      closed.currency !== payment.amount.currency
    )
      throw postingSourceMissing("enrollmentRefund:currency");
    const account =
      closed.revenueClosedAs === "REVENUE"
        ? SYSTEM_ACCOUNT_CODE.REVENUE_PLAN
        : SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME;
    lines.push(
      debit(account, allocation.amount),
      credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, allocation.amount),
    );
  }
  return lines;
}
