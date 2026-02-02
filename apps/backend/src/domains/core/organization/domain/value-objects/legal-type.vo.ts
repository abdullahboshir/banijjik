import { OrganizationLegalType } from "@banijjik/contracts";

export class OrganizationLegal {
  private constructor(private readonly value: OrganizationLegalType) {}

  public static create(value: OrganizationLegalType): OrganizationLegal {
    return new OrganizationLegal(value);
  }

  public getValue(): OrganizationLegalType {
    return this.value;
  }
}
