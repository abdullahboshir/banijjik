import type {
  Money,
  StoreCreditDirection,
  StoreCreditEntryKind,
} from "@banijjik/contracts/payment";
import type { ContactId, OrganizationId, StoreCreditEntryId, UserId } from "@banijjik/ids";

export interface StoreCreditEntryProps {
  readonly storeCreditEntryId: StoreCreditEntryId;
  readonly organizationId: OrganizationId;
  readonly contactId: ContactId;
  readonly direction: StoreCreditDirection;
  readonly kind: StoreCreditEntryKind;
  readonly amount: Money;
  readonly paymentId: string | null;
  readonly balanceAfterMinor: number;
  readonly note: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly createdByUserId: UserId | null;
}

export class StoreCreditEntry {
  private constructor(private readonly props: StoreCreditEntryProps) {}

  static create(props: StoreCreditEntryProps): StoreCreditEntry {
    return new StoreCreditEntry(props);
  }

  toProps(): StoreCreditEntryProps {
    return { ...this.props };
  }

  get storeCreditEntryId(): StoreCreditEntryId {
    return this.props.storeCreditEntryId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get contactId(): ContactId {
    return this.props.contactId;
  }

  get direction(): StoreCreditDirection {
    return this.props.direction;
  }

  get kind(): StoreCreditEntryKind {
    return this.props.kind;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get paymentId(): string | null {
    return this.props.paymentId;
  }

  get balanceAfterMinor(): number {
    return this.props.balanceAfterMinor;
  }

  get note(): string | null {
    return this.props.note;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
