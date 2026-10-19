import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  expenseCategoryArchiveRequestSchema,
  expenseCategoryCreateRequestSchema,
  expenseCategoryIdParamsSchema,
  expenseCategoryUpdateRequestSchema,
  expenseCreateRequestSchema,
  expenseIdParamsSchema,
  expenseListQuerySchema,
  expenseVoidRequestSchema,
} from "@banijjik/validation/accounting";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { ExpenseController } from "./expense.controller.js";

export interface ExpenseRouterDependencies {
  readonly controller: ExpenseController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

export function buildExpenseTenantRouter(input: ExpenseRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission, idempotency } = input;

  router.get(
    "/expenses",
    permission(PERMISSION_KEY.EXPENSE_EXPENSE_READ),
    validate({ query: expenseListQuerySchema }),
    controller.list,
  );
  router.get(
    "/expenses/:expenseId",
    permission(PERMISSION_KEY.EXPENSE_EXPENSE_READ),
    validate({ params: expenseIdParamsSchema }),
    controller.get,
  );
  router.post(
    "/expenses",
    permission(PERMISSION_KEY.EXPENSE_EXPENSE_CREATE),
    validate({ body: expenseCreateRequestSchema }),
    idempotency,
    controller.create,
  );
  router.post(
    "/expenses/:expenseId/void",
    permission(PERMISSION_KEY.EXPENSE_EXPENSE_VOID),
    validate({ params: expenseIdParamsSchema, body: expenseVoidRequestSchema }),
    controller.voidExpense,
  );

  router.get(
    "/expense-categories",
    permission(PERMISSION_KEY.EXPENSE_EXPENSE_READ),
    controller.listCategories,
  );
  router.post(
    "/expense-categories",
    permission(PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE),
    validate({ body: expenseCategoryCreateRequestSchema }),
    controller.createCategory,
  );
  router.patch(
    "/expense-categories/:expenseCategoryId",
    permission(PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE),
    validate({
      params: expenseCategoryIdParamsSchema,
      body: expenseCategoryUpdateRequestSchema,
    }),
    controller.updateCategory,
  );
  router.post(
    "/expense-categories/:expenseCategoryId/archive",
    permission(PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE),
    validate({
      params: expenseCategoryIdParamsSchema,
      body: expenseCategoryArchiveRequestSchema,
    }),
    controller.archiveCategory,
  );
  return router;
}
