import {
  CommonStatusType,
  MembershipType,
  MembershipSourceType,
} from "@banijjik/contracts";

export interface OrganizationMembershipProps {
  id?: string;
  userId: string;
  organizationId: string;
  roleId: string;
  type: MembershipType;
  designation?: string;
  memberCode?: string;
  status: CommonStatusType;
  source: MembershipSourceType;
  joinedAt: Date;
  updatedAt?: Date;
  /**
   * [CONTEXT-SPECIFIC] Dynamic Attributes
   * Stores data relevant ONLY to this Organization.
   * Defined by `industry-field-blueprint`.
   * Examples: `roll_no` (Coaching), `membership_plan` (Gym), `patient_id` (Clinic).
   */
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
  get type(): MembershipType {
    return this.props.type;
  }
  get designation(): string | undefined {
    return this.props.designation;
  }
  get memberCode(): string | undefined {
    return this.props.memberCode;
  }
  get status(): CommonStatusType {
    return this.props.status;
  }
  get source(): MembershipSourceType {
    return this.props.source;
  }
  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  toObject() {
    return { ...this.props };
  }

  updateMetadata(key: string, value: any) {
    if (!this.props.metadata) this.props.metadata = {};
    this.props.metadata[key] = value;
    this.props.updatedAt = new Date();
  }

  updateDesignation(designation: string) {
    this.props.designation = designation;
    this.props.updatedAt = new Date();
  }

  static create(props: OrganizationMembershipProps): OrganizationMembership {
    return new OrganizationMembership({
      ...props,
      updatedAt: props.updatedAt ?? new Date(),
    });
  }
}
