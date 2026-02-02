import {
  ORGANIZATION_INDUSTRY_ENUM,
  OrganizationIndustryType as ContractType,
  ORGANIZATION_INDUSTRY,
} from "@banijjik/contracts";

export class OrganizationIndustry {
  static readonly ENUM = ORGANIZATION_INDUSTRY_ENUM;
  static readonly CONSTANT = ORGANIZATION_INDUSTRY;

  // Type alias for use in domain
  static isValid(value: string): value is ContractType {
    return this.ENUM.includes(value as ContractType);
  }
}

export type OrganizationIndustryType = ContractType;
