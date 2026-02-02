import { OrganizationNatureType } from "@banijjik/contracts";

export class OrganizationNature {
  private constructor(private readonly value: OrganizationNatureType) {}

  public static create(value: OrganizationNatureType): OrganizationNature {
    return new OrganizationNature(value);
  }

  public getValue(): OrganizationNatureType {
    return this.value;
  }
}
