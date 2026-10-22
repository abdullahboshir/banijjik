import type { Money, PaymentStatus } from "@banijjik/contracts/payment";
import type { OrganizationId } from "@banijjik/ids";

export interface DepositCheckPort {
  isDepositSatisfied(input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
    readonly requiredAmount: Money;
  }): Promise<boolean>;
}

export interface PaymentStatusReader {
  readStatus(input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
  }): Promise<PaymentStatus>;
}
