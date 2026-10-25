import type {
  Money,
  PaymentAllocation,
  PaymentApprovalSnapshot,
  PaymentDirection,
  PaymentMethod,
  PaymentWriteOff,
} from "@banijjik/contracts/payment";
import type { LocationId, OrganizationId, PaymentId, UserId } from "@banijjik/ids";

export interface PaymentProps {
  readonly paymentId: PaymentId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly paymentNumber: string;
  readonly direction: PaymentDirection;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference: string | null;
  readonly reversesPaymentId: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly writeOffs: readonly PaymentWriteOff[];
  readonly contactId: string | null;
  readonly receivedByMemberId: string;
  readonly businessDate: string;
  readonly approval: PaymentApprovalSnapshot | null;
  readonly note: string | null;
  /** The register session a till payment belongs to (11 section 7.1); null for every other payment. */
  readonly posSessionId?: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class Payment {
  private constructor(private readonly props: PaymentProps) {}

  static create(props: PaymentProps): Payment {
    return new Payment(props);
  }

  toProps(): PaymentProps {
    return { ...this.props };
  }

  get paymentId(): PaymentId {
    return this.props.paymentId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get locationId(): LocationId {
    return this.props.locationId;
  }

  get paymentNumber(): string {
    return this.props.paymentNumber;
  }

  get direction(): PaymentDirection {
    return this.props.direction;
  }

  get method(): PaymentMethod {
    return this.props.method;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get externalReference(): string | null {
    return this.props.externalReference;
  }

  get reversesPaymentId(): string | null {
    return this.props.reversesPaymentId;
  }

  get allocations(): readonly PaymentAllocation[] {
    return this.props.allocations;
  }

  get writeOffs(): readonly PaymentWriteOff[] {
    return this.props.writeOffs;
  }

  get contactId(): string | null {
    return this.props.contactId;
  }

  get receivedByMemberId(): string {
    return this.props.receivedByMemberId;
  }

  get businessDate(): string {
    return this.props.businessDate;
  }

  get approval(): PaymentApprovalSnapshot | null {
    return this.props.approval;
  }

  get note(): string | null {
    return this.props.note;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
