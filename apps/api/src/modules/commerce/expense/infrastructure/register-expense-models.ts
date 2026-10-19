import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  EXPENSE_CATEGORY_COLLECTION_NAME,
  EXPENSE_CATEGORY_MODEL_NAME,
  EXPENSE_COLLECTION_NAME,
  EXPENSE_MODEL_NAME,
  expenseCategorySchema,
  expenseSchema,
} from "./expense.schema.js";

export function registerExpenseModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: EXPENSE_CATEGORY_MODEL_NAME,
    collectionName: EXPENSE_CATEGORY_COLLECTION_NAME,
    schema: expenseCategorySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: EXPENSE_MODEL_NAME,
    collectionName: EXPENSE_COLLECTION_NAME,
    schema: expenseSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}
