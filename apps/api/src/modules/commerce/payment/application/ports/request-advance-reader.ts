import type { Money, PaymentRequestType } from "@banijjik/contracts/payment";
import type { OrganizationId } from "@banijjik/ids";

/**
 * Net BEFORE_REVENUE money a payment request currently holds: IN allocations minus the refunds
 * and reversals of them. Matches the rule accounting uses to decide whether a refund or reversal
 * debits CUSTOMER_ADVANCES (`accounting/domain/posting-rules.ts`): an allocation counts while its
 * stored revenue state is BEFORE_REVENUE, exactly as it was posted on capture.
 */
export interface RequestAdvanceReader {
  readHeldAdvance(input: {
    readonly organizationId: OrganizationId;
    readonly requestType: PaymentRequestType;
    readonly requestId: string;
  }): Promise<Money>;
}
