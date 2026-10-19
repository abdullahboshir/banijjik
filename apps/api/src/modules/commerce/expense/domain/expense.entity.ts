import {
  EXPENSE_STATUS,
  type ExpensePaidVia,
  type ExpenseStatus,
  type Money,
} from "@banijjik/contracts/accounting";
import {
  asId,
  newId,
  type ExpenseCategoryId,
  type ExpenseId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { alreadyVoided } from "./errors.js";

export interface ExpenseProps {
  readonly expenseId: ExpenseId;
  readonly organizationId: OrganizationId;
  readonly expenseNumber: string;
  readonly expenseCategoryId: ExpenseCategoryId;
  readonly amount: Money;
  readonly paidVia: ExpensePaidVia;
  readonly businessDate: string;
  readonly locationId: LocationId;
  readonly note: string | null;
  readonly attachmentFileIds: readonly string[];
  readonly status: ExpenseStatus;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly voidReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class Expense {
  private constructor(private readonly props: ExpenseProps) {}

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly expenseNumber: string;
    readonly expenseCategoryId: ExpenseCategoryId;
    readonly amount: Money;
    readonly paidVia: ExpensePaidVia;
    readonly businessDate: string;
    readonly locationId: LocationId;
    readonly note: string | null;
    readonly attachmentFileIds: readonly string[];
    readonly customFields: Readonly<Record<string, unknown>>;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Expense {
    return new Expense({
      expenseId: asId<ExpenseId>(newId()),
      organizationId: input.organizationId,
      expenseNumber: input.expenseNumber,
      expenseCategoryId: input.expenseCategoryId,
      amount: input.amount,
      paidVia: input.paidVia,
      businessDate: input.businessDate,
      locationId: input.locationId,
      note: input.note,
      attachmentFileIds: input.attachmentFileIds,
      status: EXPENSE_STATUS.POSTED,
      customFields: input.customFields,
      voidReason: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: ExpenseProps): Expense {
    return new Expense(props);
  }

  get expenseId(): ExpenseId {
    return this.props.expenseId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get expenseNumber(): string {
    return this.props.expenseNumber;
  }

  get expenseCategoryId(): ExpenseCategoryId {
    return this.props.expenseCategoryId;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get paidVia(): ExpensePaidVia {
    return this.props.paidVia;
  }

  get businessDate(): string {
    return this.props.businessDate;
  }

  get locationId(): LocationId {
    return this.props.locationId;
  }

  get note(): string | null {
    return this.props.note;
  }

  get attachmentFileIds(): readonly string[] {
    return this.props.attachmentFileIds;
  }

  get status(): ExpenseStatus {
    return this.props.status;
  }

  get customFields(): Readonly<Record<string, unknown>> {
    return this.props.customFields;
  }

  get voidReason(): string | null {
    return this.props.voidReason;
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

  void(reason: string, now: Date, actorUserId: UserId | null): Expense {
    if (this.props.status === EXPENSE_STATUS.VOIDED) throw alreadyVoided();
    return new Expense({
      ...this.props,
      status: EXPENSE_STATUS.VOIDED,
      voidReason: reason,
      version: this.props.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
}
