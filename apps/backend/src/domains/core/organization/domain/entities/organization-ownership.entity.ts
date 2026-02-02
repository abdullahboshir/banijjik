import {
  OwnershipStatus,
  OwnershipStatusType,
} from "../value-objects/ownership-status.vo";

export interface OrganizationOwnershipProps {
  ownershipId: string;
  organizationId: string;
  userId: string;

  // Legal & Compliance
  legalAcceptedAt: Date;
  termsVersion: string;
  taxIdentifier?: string;

  // Billing
  billingEmail: string;
  billingPhone?: string;

  // Account Security
  accountRecoveryEmail?: string;
  accountRecoveryPhone?: string;

  // Ownership History
  transferredFrom?: string;
  transferredAt?: Date;

  // Status
  status: OwnershipStatusType;

  createdAt?: Date;
  updatedAt?: Date;
}

export class OrganizationOwnership {
  private props: OrganizationOwnershipProps & {
    createdAt: Date;
    updatedAt: Date;
  };

  constructor(props: OrganizationOwnershipProps) {
    this.props = {
      ...props,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  get ownershipId(): string {
    return this.props.ownershipId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get legalAcceptedAt(): Date {
    return this.props.legalAcceptedAt;
  }
  get termsVersion(): string {
    return this.props.termsVersion;
  }
  get taxIdentifier(): string | undefined {
    return this.props.taxIdentifier;
  }
  get billingEmail(): string {
    return this.props.billingEmail;
  }
  get billingPhone(): string | undefined {
    return this.props.billingPhone;
  }
  get accountRecoveryEmail(): string | undefined {
    return this.props.accountRecoveryEmail;
  }
  get accountRecoveryPhone(): string | undefined {
    return this.props.accountRecoveryPhone;
  }
  get transferredFrom(): string | undefined {
    return this.props.transferredFrom;
  }
  get transferredAt(): Date | undefined {
    return this.props.transferredAt;
  }
  get status(): OwnershipStatusType {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Transfer ownership to a new user
   */
  transferTo(newUserId: string): OrganizationOwnership {
    return new OrganizationOwnership({
      ...this.props,
      transferredFrom: this.props.userId,
      transferredAt: new Date(),
      userId: newUserId,
      status: OwnershipStatus.VALUE.ACTIVE,
      updatedAt: new Date(),
    });
  }

  /**
   * Suspend ownership (e.g., for non-payment)
   */
  suspend(): void {
    this.props.status = OwnershipStatus.VALUE.SUSPENDED;
    this.touch();
  }

  /**
   * Reactivate ownership
   */
  reactivate(): void {
    this.props.status = OwnershipStatus.VALUE.ACTIVE;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  toPrimitives(): OrganizationOwnershipProps {
    return { ...this.props };
  }

  static create(props: OrganizationOwnershipProps): OrganizationOwnership {
    return new OrganizationOwnership(props);
  }
}
