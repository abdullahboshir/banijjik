import type { CancelFeeMode } from "@banijjik/contracts/booking";
import type { Money, PaymentStatus } from "@banijjik/contracts/payment";
import type { ContactId, LocationId, OrganizationId, UserId } from "@banijjik/ids";

export interface DepositCheckPort {
  isDepositSatisfied(input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
    readonly requiredAmount: Money;
  }): Promise<boolean>;

  initializeSummary?(input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
    readonly contactId: ContactId;
    readonly locationId: LocationId;
    readonly total: Money;
    readonly actorUserId: UserId | null;
    readonly now: Date;
  }): Promise<void>;

  settleBookingTermination?(input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
    readonly contactId: ContactId;
    readonly locationId: LocationId;
    readonly startsAt: Date;
    readonly depositRequired: Money;
    readonly priceTotal: Money;
    readonly mode: "CANCEL" | "NO_SHOW";
    readonly freeCancelHours: number;
    readonly feeMode: CancelFeeMode;
    readonly feePercent: number;
    readonly actorUserId: UserId | null;
    readonly now: Date;
  }): Promise<{ readonly feeRetained: Money | null }>;
}

export interface PaymentStatusReader {
  readStatus(input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
  }): Promise<PaymentStatus>;
}
