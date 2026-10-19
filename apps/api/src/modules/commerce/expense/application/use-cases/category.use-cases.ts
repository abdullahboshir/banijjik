import {
  EXPENSE_CATEGORY_STATUS,
  type ExpenseCategoryResponse,
} from "@banijjik/contracts/accounting";
import { AUDIT_ACTION } from "@banijjik/contracts";
import {
  asId,
  newId,
  type ExpenseCategoryId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { ExpenseCategoryCreateBody, ExpenseCategoryUpdateBody } from "@banijjik/validation";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { ExpenseCategory } from "../../domain/expense-category.entity.js";
import { recordNotFound } from "../../domain/errors.js";
import { toCategoryResponse } from "../expense-views.js";
import type { CategoryAccountWriter } from "../seed-expense-categories.js";
import type { ExpenseCategoryRepository } from "../ports/expense-repositories.js";
import type { ExpenseUnitOfWork } from "./expense.use-cases.js";

export interface CategoryWriteDependencies {
  readonly categories: ExpenseCategoryRepository;
  readonly accounts: CategoryAccountWriter;
  readonly unitOfWork: ExpenseUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

function customAccountCode(expenseCategoryId: string): string {
  return `EXPENSE_CUSTOM_${expenseCategoryId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export class CreateExpenseCategoryUseCase {
  constructor(private readonly dependencies: CategoryWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly body: ExpenseCategoryCreateBody;
  }): Promise<ExpenseCategoryResponse> {
    return this.dependencies.unitOfWork.run(async () => {
      const expenseCategoryId = asId<ExpenseCategoryId>(newId());
      const account = await this.dependencies.accounts.ensureExpenseAccount({
        organizationId: input.organizationId,
        accountCode: customAccountCode(expenseCategoryId),
        name: input.body.name,
        actorUserId: input.actorUserId,
      });
      const now = this.dependencies.clock.now();
      const category = ExpenseCategory.rehydrate({
        expenseCategoryId,
        organizationId: input.organizationId,
        name: input.body.name,
        accountId: account.accountId,
        accountCode: account.accountCode,
        status: EXPENSE_CATEGORY_STATUS.ACTIVE,
        isSystem: false,
        categoryKey: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      });
      await this.dependencies.categories.insert(category);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.EXPENSE_CATEGORY_UPDATED,
        entityType: "expenseCategory",
        entityId: category.expenseCategoryId,
        changes: { name: { to: category.name.en } },
      });
      return toCategoryResponse(category);
    });
  }
}

export class UpdateExpenseCategoryUseCase {
  constructor(private readonly dependencies: CategoryWriteDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly expenseCategoryId: ExpenseCategoryId;
    readonly body: ExpenseCategoryUpdateBody;
  }): Promise<ExpenseCategoryResponse> {
    const existing = await this.dependencies.categories.findById(input.expenseCategoryId);
    if (existing === undefined) throw recordNotFound();
    const expectedVersion = input.body.version ?? existing.version;
    const updated = existing.rename(
      input.body.name,
      this.dependencies.clock.now(),
      input.actorUserId,
    );
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.categories.save(updated, expectedVersion);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.EXPENSE_CATEGORY_UPDATED,
        entityType: "expenseCategory",
        entityId: updated.expenseCategoryId,
        changes: { name: { from: existing.name.en, to: updated.name.en } },
      });
    });
    return toCategoryResponse(updated);
  }
}

export class ArchiveExpenseCategoryUseCase {
  constructor(private readonly dependencies: CategoryWriteDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly expenseCategoryId: ExpenseCategoryId;
    readonly version?: number | undefined;
  }): Promise<ExpenseCategoryResponse> {
    const existing = await this.dependencies.categories.findById(input.expenseCategoryId);
    if (existing === undefined) throw recordNotFound();
    const expectedVersion = input.version ?? existing.version;
    const archived = existing.archive(this.dependencies.clock.now(), input.actorUserId);
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.categories.save(archived, expectedVersion);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.EXPENSE_CATEGORY_UPDATED,
        entityType: "expenseCategory",
        entityId: archived.expenseCategoryId,
        changes: { status: { from: existing.status, to: archived.status } },
      });
    });
    return toCategoryResponse(archived);
  }
}
