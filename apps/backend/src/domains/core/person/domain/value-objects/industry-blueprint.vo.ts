import {
  INDUSTRY_BLUEPRINTS as CONTRACT_BLUEPRINTS,
  IndustryBlueprint as ContractIndustryBlueprint,
} from "@banijjik/contracts";

export class IndustryBlueprint {
  static readonly VALUE = CONTRACT_BLUEPRINTS;
  static readonly TYPE = CONTRACT_BLUEPRINTS;

  static get(key: string) {
    return this.VALUE[key];
  }
}
