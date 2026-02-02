import {
  OrganizationIndustryType,
  ORGANIZATION_INDUSTRY,
} from "@banijjik/contracts";

export class OrganizationIndustry {
  private constructor(private readonly value: OrganizationIndustryType) {}

  public static create(value: OrganizationIndustryType): OrganizationIndustry {
    // Validation logic if needed
    if (!Object.values(ORGANIZATION_INDUSTRY).includes(value)) {
      throw new Error("Invalid Industry Type");
    }
    return new OrganizationIndustry(value);
  }

  public getValue(): OrganizationIndustryType {
    return this.value;
  }
}
