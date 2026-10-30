import type { PaymentRequestType } from "@banijjik/contracts/payment";

export interface RequestPaymentLifecycle {
  beginReceipt(input: {
    readonly organizationId: string;
    readonly requestType: PaymentRequestType;
    readonly requestId: string;
    readonly now: Date;
  }): Promise<void>;
  endReceipt(input: {
    readonly organizationId: string;
    readonly requestType: PaymentRequestType;
    readonly requestId: string;
    readonly now: Date;
  }): Promise<void>;
}

export class RequestPaymentLifecycleRegistry {
  private readonly lifecycles = new Map<PaymentRequestType, RequestPaymentLifecycle>();

  register(requestType: PaymentRequestType, lifecycle: RequestPaymentLifecycle): void {
    this.lifecycles.set(requestType, lifecycle);
  }

  get(requestType: PaymentRequestType): RequestPaymentLifecycle | undefined {
    return this.lifecycles.get(requestType);
  }
}
