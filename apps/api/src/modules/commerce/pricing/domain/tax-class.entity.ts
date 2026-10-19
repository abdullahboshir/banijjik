import { TAX_CLASS_STATUS, type TaxClassStatus } from "@banijjik/contracts/pricing";
import { newId, type OrganizationId, type TaxClassId, type UserId } from "@banijjik/ids";
import { invalidTransition } from "./errors.js";

export interface TaxClassProps {
  readonly taxClassId: TaxClassId;
  readonly organizationId: OrganizationId;
  readonly taxClassKey: string;
  readonly name: string;
  readonly rateBasisPoints: number;
  readonly status: TaxClassStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewTaxClassInput {
  readonly organizationId: OrganizationId;
  readonly taxClassKey: string;
  readonly name: string;
  readonly rateBasisPoints: number;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface TaxClassChanges {
  readonly name?: string;
  readonly rateBasisPoints?: number;
}

const INITIAL_VERSION = 1;

export class TaxClass implements TaxClassProps {
  readonly taxClassId: TaxClassId;
  readonly organizationId: OrganizationId;
  readonly taxClassKey: string;
  readonly name: string;
  readonly rateBasisPoints: number;
  readonly status: TaxClassStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: TaxClassProps) {
    this.taxClassId = props.taxClassId;
    this.organizationId = props.organizationId;
    this.taxClassKey = props.taxClassKey;
    this.name = props.name;
    this.rateBasisPoints = props.rateBasisPoints;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  static create(input: NewTaxClassInput): TaxClass {
    return new TaxClass({
      taxClassId: newId() as TaxClassId,
      organizationId: input.organizationId,
      taxClassKey: input.taxClassKey,
      name: input.name,
      rateBasisPoints: input.rateBasisPoints,
      status: TAX_CLASS_STATUS.ACTIVE,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  static restore(props: TaxClassProps): TaxClass {
    return new TaxClass(props);
  }

  withChanges(changes: TaxClassChanges, now: Date): TaxClass {
    if (this.status === TAX_CLASS_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new TaxClass({
      ...this,
      name: changes.name ?? this.name,
      rateBasisPoints: changes.rateBasisPoints ?? this.rateBasisPoints,
      updatedAt: now,
    });
  }

  archive(now: Date): TaxClass {
    if (this.status === TAX_CLASS_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new TaxClass({ ...this, status: TAX_CLASS_STATUS.ARCHIVED, updatedAt: now });
  }
}
