import { CommonStatusType } from "@banijjik/contracts";

export interface OrganizationMembershipProps {
  id?: string;
  userId: string;
  organizationId: string;
  roleId: string;
  status: CommonStatusType;
  joinedAt: Date;
  metadata?: Record<string, any>;
}

export class OrganizationMembership {
  constructor(private readonly props: OrganizationMembershipProps) {}

  get id(): string | undefined {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get roleId(): string {
    return this.props.roleId;
  }
  get status(): CommonStatusType {
    return this.props.status;
  }
  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  toObject() {
    return { ...this.props };
  }

  static create(props: OrganizationMembershipProps): OrganizationMembership {
    return new OrganizationMembership(props);
  }
}
