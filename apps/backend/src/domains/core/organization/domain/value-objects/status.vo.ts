import {
  OrganizationStatusType,
  ORGANIZATION_STATUS,
} from "@banijjik/contracts";

export class OrganizationStatus {
  private constructor(private readonly value: OrganizationStatusType) {}

  public static create(value: OrganizationStatusType): OrganizationStatus {
    return new OrganizationStatus(value);
  }

  public static get ACTIVE(): OrganizationStatus {
    return new OrganizationStatus(ORGANIZATION_STATUS.ACTIVE);
  }

  public static get PENDING(): OrganizationStatus {
    return new OrganizationStatus(ORGANIZATION_STATUS.PENDING);
  }

  public getValue(): OrganizationStatusType {
    return this.value;
  }
}
