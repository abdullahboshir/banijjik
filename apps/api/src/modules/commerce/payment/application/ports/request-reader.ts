import type { Money, PaymentRequestType } from "@banijjik/contracts/payment";
import type { LocationId, OrganizationId } from "@banijjik/ids";

export interface RequestReadSnapshot {
  readonly requestId: string;
  readonly requestType: PaymentRequestType;
  readonly total: Money;
  readonly revenueState: "BEFORE_REVENUE" | "AFTER_REVENUE";
  readonly contactId: string | null;
  readonly locationId: LocationId | null;
  readonly acceptsPayments: boolean;
  readonly refundLimit: Money | null;
}

export interface RequestReader {
  read(organizationId: OrganizationId, requestId: string): Promise<RequestReadSnapshot | undefined>;
}

export class RequestReaderRegistry {
  private readonly readers = new Map<PaymentRequestType, RequestReader>();

  register(requestType: PaymentRequestType, reader: RequestReader): void {
    this.readers.set(requestType, reader);
  }

  get(requestType: PaymentRequestType): RequestReader | undefined {
    return this.readers.get(requestType);
  }
}
