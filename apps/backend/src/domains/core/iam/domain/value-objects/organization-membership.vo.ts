import { CommonStatusType } from "@banijjik/contracts";

export class OrganizationMembershipVO {
  constructor(
    private readonly role: string,
    private readonly organization: string,
    private readonly status: CommonStatusType,
  ) {}

  static create(props: {
    role: string;
    organization: string;
    status: CommonStatusType;
  }): OrganizationMembershipVO {
    if (!props.role || !props.organization) {
      throw new Error(
        "OrganizationMembershipVO requires role and organization",
      );
    }
    return new OrganizationMembershipVO(
      props.role,
      props.organization,
      props.status,
    );
  }

  getRole(): string {
    return this.role;
  }
  getOrganization(): string {
    return this.organization;
  }
  getStatus(): CommonStatusType {
    return this.status;
  }

  toObject() {
    return {
      role: this.role,
      organization: this.organization,
      status: this.status,
    };
  }
}
