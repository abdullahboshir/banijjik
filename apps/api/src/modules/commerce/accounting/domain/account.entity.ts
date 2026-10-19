import {
  ACCOUNT_STATUS,
  ACCOUNT_TYPE,
  type AccountStatus,
  type AccountType,
  type LocalizedAccountName,
} from "@banijjik/contracts/accounting";
import { asId, newId, type AccountId, type OrganizationId, type UserId } from "@banijjik/ids";

export interface AccountProps {
  readonly accountId: AccountId;
  readonly organizationId: OrganizationId;
  readonly accountCode: string;
  readonly name: LocalizedAccountName;
  readonly accountType: AccountType;
  readonly isSystem: boolean;
  readonly status: AccountStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class Account {
  private constructor(private readonly props: AccountProps) {}

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly accountCode: string;
    readonly name: LocalizedAccountName;
    readonly accountType: AccountType;
    readonly isSystem: boolean;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Account {
    return new Account({
      accountId: asId<AccountId>(newId()),
      organizationId: input.organizationId,
      accountCode: input.accountCode,
      name: input.name,
      accountType: input.accountType,
      isSystem: input.isSystem,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: AccountProps): Account {
    return new Account(props);
  }

  get accountId(): AccountId {
    return this.props.accountId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get accountCode(): string {
    return this.props.accountCode;
  }

  get name(): LocalizedAccountName {
    return this.props.name;
  }

  get accountType(): AccountType {
    return this.props.accountType;
  }

  get isSystem(): boolean {
    return this.props.isSystem;
  }

  get status(): AccountStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  static readonly ACCOUNT_TYPE = ACCOUNT_TYPE;
}
