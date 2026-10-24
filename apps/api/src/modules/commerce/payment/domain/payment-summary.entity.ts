import type { Money, PaymentRequestType, PaymentStatus } from "@banijjik/contracts/payment";
import type { LocationId, OrganizationId } from "@banijjik/ids";

export interface PaymentSummaryProps {
  readonly organizationId: OrganizationId;
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly contactId: string | null;
  readonly locationId: LocationId;
  readonly total: Money;
  readonly allocated: Money;
  readonly refunded: Money;
  readonly paymentStatus: PaymentStatus;
  /** Set when the request was closed at a lower total (cancel, no-show); null while open. */
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
}

export class PaymentSummary {
  private constructor(private readonly props: PaymentSummaryProps) {}

  static create(props: PaymentSummaryProps): PaymentSummary {
    return new PaymentSummary(props);
  }

  toProps(): PaymentSummaryProps {
    return { ...this.props };
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get requestType(): PaymentRequestType {
    return this.props.requestType;
  }

  get requestId(): string {
    return this.props.requestId;
  }

  get contactId(): string | null {
    return this.props.contactId;
  }

  get locationId(): LocationId {
    return this.props.locationId;
  }

  get total(): Money {
    return this.props.total;
  }

  get allocated(): Money {
    return this.props.allocated;
  }

  get refunded(): Money {
    return this.props.refunded;
  }

  get paymentStatus(): PaymentStatus {
    return this.props.paymentStatus;
  }

  get closedAt(): Date | null {
    return this.props.closedAt;
  }

  get due(): Money {
    const netPaid = this.props.allocated.amount - this.props.refunded.amount;
    const dueAmount = Math.max(0, this.props.total.amount - netPaid);
    return { amount: dueAmount, currency: this.props.total.currency };
  }
}
