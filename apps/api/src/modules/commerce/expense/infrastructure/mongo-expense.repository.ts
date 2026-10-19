import { EXPENSE_CATEGORY_STATUS } from "@banijjik/contracts/accounting";
import {
  asId,
  type AccountId,
  type ExpenseCategoryId,
  type ExpenseId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  ExpenseCategoryRepository,
  ExpenseListFilter,
  ExpenseRepository,
} from "../application/ports/expense-repositories.js";
import { ExpenseCategory } from "../domain/expense-category.entity.js";
import { Expense } from "../domain/expense.entity.js";
import {
  EXPENSE_CATEGORY_MODEL_NAME,
  EXPENSE_MODEL_NAME,
  type ExpenseCategoryDocument,
  type ExpenseDocument,
} from "./expense.schema.js";

function expenseModel(): Model<ExpenseDocument> {
  return models({}).get<ExpenseDocument>(EXPENSE_MODEL_NAME);
}

function categoryModel(): Model<ExpenseCategoryDocument> {
  return models({}).get<ExpenseCategoryDocument>(EXPENSE_CATEGORY_MODEL_NAME);
}

function toCategory(row: ExpenseCategoryDocument): ExpenseCategory {
  return ExpenseCategory.rehydrate({
    expenseCategoryId: asId<ExpenseCategoryId>(row.expenseCategoryId),
    organizationId: asId<OrganizationId>(row.organizationId),
    name: row.name,
    accountId: asId<AccountId>(row.accountId),
    accountCode: row.accountCode,
    status: row.status,
    isSystem: row.isSystem,
    categoryKey: row.categoryKey,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

function toExpense(row: ExpenseDocument): Expense {
  return Expense.rehydrate({
    expenseId: asId<ExpenseId>(row.expenseId),
    organizationId: asId<OrganizationId>(row.organizationId),
    expenseNumber: row.expenseNumber,
    expenseCategoryId: asId<ExpenseCategoryId>(row.expenseCategoryId),
    amount: { amount: row.amount.amount, currency: row.amount.currency as "BDT" },
    paidVia: row.paidVia,
    businessDate: row.businessDate,
    locationId: asId<LocationId>(row.locationId),
    note: row.note,
    attachmentFileIds: row.attachmentFileIds,
    status: row.status,
    customFields: row.customFields,
    voidReason: row.voidReason,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

export class MongoExpenseCategoryRepository implements ExpenseCategoryRepository {
  async insert(category: ExpenseCategory): Promise<"inserted" | "duplicate"> {
    try {
      await categoryModel().create(
        [
          {
            expenseCategoryId: category.expenseCategoryId,
            organizationId: category.organizationId,
            name: category.name,
            accountId: category.accountId,
            accountCode: category.accountCode,
            status: category.status,
            isSystem: category.isSystem,
            categoryKey: category.categoryKey,
            version: category.version,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
            createdByUserId: category.createdByUserId,
            updatedByUserId: category.updatedByUserId,
          },
        ],
        sessionOption(getActiveSession()),
      );
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error)) return "duplicate";
      throw error;
    }
  }

  async save(category: ExpenseCategory, expectedVersion: number): Promise<void> {
    await updateVersioned<ExpenseCategoryDocument>({
      model: categoryModel(),
      filter: { expenseCategoryId: category.expenseCategoryId },
      expectedVersion,
      update: {
        $set: {
          name: category.name,
          status: category.status,
          updatedAt: category.updatedAt,
          updatedByUserId: category.updatedByUserId,
        },
      },
    });
  }

  async findById(expenseCategoryId: ExpenseCategoryId): Promise<ExpenseCategory | undefined> {
    const row = await categoryModel()
      .findOne({ expenseCategoryId })
      .lean<ExpenseCategoryDocument>();
    return row === null ? undefined : toCategory(row);
  }

  async findByKey(categoryKey: string): Promise<ExpenseCategory | undefined> {
    const row = await categoryModel().findOne({ categoryKey }).lean<ExpenseCategoryDocument>();
    return row === null ? undefined : toCategory(row);
  }

  async list(): Promise<ExpenseCategory[]> {
    const active = await categoryModel()
      .find({ status: EXPENSE_CATEGORY_STATUS.ACTIVE })
      .sort({ accountCode: 1 })
      .lean<ExpenseCategoryDocument[]>();
    const archived = await categoryModel()
      .find({ status: EXPENSE_CATEGORY_STATUS.ARCHIVED })
      .sort({ accountCode: 1 })
      .lean<ExpenseCategoryDocument[]>();
    return [...active, ...archived].map(toCategory);
  }
}

export class MongoExpenseRepository implements ExpenseRepository {
  async insert(expense: Expense): Promise<void> {
    await expenseModel().create(
      [
        {
          expenseId: expense.expenseId,
          organizationId: expense.organizationId,
          expenseNumber: expense.expenseNumber,
          expenseCategoryId: expense.expenseCategoryId,
          amount: expense.amount,
          paidVia: expense.paidVia,
          businessDate: expense.businessDate,
          locationId: expense.locationId,
          note: expense.note,
          attachmentFileIds: [...expense.attachmentFileIds],
          status: expense.status,
          customFields: { ...expense.customFields },
          voidReason: expense.voidReason,
          version: expense.version,
          createdAt: expense.createdAt,
          updatedAt: expense.updatedAt,
          createdByUserId: expense.createdByUserId,
          updatedByUserId: expense.updatedByUserId,
        },
      ],
      sessionOption(getActiveSession()),
    );
  }

  async save(expense: Expense, expectedVersion: number): Promise<void> {
    await updateVersioned<ExpenseDocument>({
      model: expenseModel(),
      filter: { expenseId: expense.expenseId },
      expectedVersion,
      update: {
        $set: {
          status: expense.status,
          voidReason: expense.voidReason,
          updatedAt: expense.updatedAt,
          updatedByUserId: expense.updatedByUserId,
        },
      },
    });
  }

  async findById(expenseId: ExpenseId): Promise<Expense | undefined> {
    const row = await expenseModel().findOne({ expenseId }).lean<ExpenseDocument>();
    return row === null ? undefined : toExpense(row);
  }

  async list(
    filter: ExpenseListFilter,
  ): Promise<{ readonly items: Expense[]; readonly hasNext: boolean }> {
    const query: QueryFilter<ExpenseDocument> = {};
    if (filter.locationId !== undefined) query.locationId = filter.locationId;
    if (filter.expenseCategoryId !== undefined) query.expenseCategoryId = filter.expenseCategoryId;
    if (filter.from !== undefined || filter.to !== undefined) {
      query.businessDate = {
        ...(filter.from === undefined ? {} : { $gte: filter.from }),
        ...(filter.to === undefined ? {} : { $lte: filter.to }),
      };
    }
    const rows = await expenseModel()
      .find(query)
      .sort({ businessDate: -1, expenseId: -1 })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit + 1)
      .lean<ExpenseDocument[]>();
    const hasNext = rows.length > filter.limit;
    return { items: rows.slice(0, filter.limit).map(toExpense), hasNext };
  }
}
