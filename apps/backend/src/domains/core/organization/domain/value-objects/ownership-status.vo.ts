import {
  OWNERSHIP_STATUS,
  OWNERSHIP_STATUS_ENUM,
  OwnershipStatusType as ContractType,
} from "@banijjik/contracts";

export class OwnershipStatus {
  static readonly VALUE = OWNERSHIP_STATUS;
  static readonly ENUM = OWNERSHIP_STATUS_ENUM;

  static isValid(value: string): value is ContractType {
    return this.ENUM.includes(value as ContractType);
  }
}

export type OwnershipStatusType = ContractType;
