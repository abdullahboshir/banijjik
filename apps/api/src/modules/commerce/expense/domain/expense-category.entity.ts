import {
  EXPENSE_CATEGORY_STATUS,
  type ExpenseCategoryStatus,
} from "@banijjik/contracts/accounting";
import {
  asId,
  newId,
  type AccountId,
  type ExpenseCategoryId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { categoryArchived } from "./errors.js";

export interface ExpenseCategoryProps {
  readonly expenseCategoryId: ExpenseCategoryId;
  readonly organizationId: OrganizationId;
  readonly name: { readonly bn: string; readonly en: string };
  readonly accountId: AccountId;
  readonly accountCode: string;
  readonly status: ExpenseCategoryStatus;
  readonly isSystem: boolean;
  readonly categoryKey: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class ExpenseCategory {
  private constructor(private readonly props: ExpenseCategoryProps) {}

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly name: { readonly bn: string; readonly en: string };
    readonly accountId: AccountId;
    readonly accountCode: string;
    readonly isSystem: boolean;
    readonly categoryKey: string | null;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): ExpenseCategory {
    return new ExpenseCategory({
      expenseCategoryId: asId<ExpenseCategoryId>(newId()),
      organizationId: input.organizationId,
      name: input.name,
      accountId: input.accountId,
      accountCode: input.accountCode,
      status: EXPENSE_CATEGORY_STATUS.ACTIVE,
      isSystem: input.isSystem,
      categoryKey: input.categoryKey,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: ExpenseCategoryProps): ExpenseCategory {
    return new ExpenseCategory(props);
  }

  get expenseCategoryId(): ExpenseCategoryId {
    return this.props.expenseCategoryId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get name(): { readonly bn: string; readonly en: string } {
    return this.props.name;
  }

  get accountId(): AccountId {
    return this.props.accountId;
  }

  get accountCode(): string {
    return this.props.accountCode;
  }

  get status(): ExpenseCategoryStatus {
    return this.props.status;
  }

  get isSystem(): boolean {
    return this.props.isSystem;
  }

  get categoryKey(): string | null {
    return this.props.categoryKey;
  }

  get version(): number {
    return this.props.version;
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

  get isActive(): boolean {
    return this.props.status === EXPENSE_CATEGORY_STATUS.ACTIVE;
  }

  rename(
    name: { readonly bn: string; readonly en: string },
    now: Date,
    actorUserId: UserId | null,
  ): ExpenseCategory {
    if (!this.isActive) throw categoryArchived();
    return new ExpenseCategory({
      ...this.props,
      name,
      version: this.props.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  archive(now: Date, actorUserId: UserId | null): ExpenseCategory {
    if (!this.isActive) throw categoryArchived();
    return new ExpenseCategory({
      ...this.props,
      status: EXPENSE_CATEGORY_STATUS.ARCHIVED,
      version: this.props.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
}
