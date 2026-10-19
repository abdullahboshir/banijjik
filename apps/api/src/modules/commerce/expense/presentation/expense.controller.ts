import { asId, type ExpenseCategoryId, type ExpenseId } from "@banijjik/ids";
import type {
  ExpenseCategoryArchiveBody,
  ExpenseCategoryCreateBody,
  ExpenseCategoryUpdateBody,
  ExpenseCreateBody,
  ExpenseListQuery,
  ExpenseVoidBody,
} from "@banijjik/validation/accounting";
import type { Request, RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ArchiveExpenseCategoryUseCase,
  CreateExpenseCategoryUseCase,
  UpdateExpenseCategoryUseCase,
} from "../application/use-cases/category.use-cases.js";
import type {
  CreateExpenseUseCase,
  GetExpenseUseCase,
  ListExpenseCategoriesUseCase,
  ListExpensesUseCase,
  VoidExpenseUseCase,
} from "../application/use-cases/expense.use-cases.js";

const HTTP_CREATED = 201;

export interface ExpenseControllerDependencies {
  readonly listExpenses: ListExpensesUseCase;
  readonly getExpense: GetExpenseUseCase;
  readonly createExpense: CreateExpenseUseCase;
  readonly voidExpense: VoidExpenseUseCase;
  readonly listCategories: ListExpenseCategoriesUseCase;
  readonly createCategory: CreateExpenseCategoryUseCase;
  readonly updateCategory: UpdateExpenseCategoryUseCase;
  readonly archiveCategory: ArchiveExpenseCategoryUseCase;
}

function readExpenseId(request: Request): ExpenseId {
  return asId<ExpenseId>(String(request.params["expenseId"]));
}

function readCategoryId(request: Request): ExpenseCategoryId {
  return asId<ExpenseCategoryId>(String(request.params["expenseCategoryId"]));
}

export class ExpenseController {
  constructor(private readonly dependencies: ExpenseControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as ExpenseListQuery;
    const result = await this.dependencies.listExpenses.execute(query);
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly get: RequestHandler = async (request, response) => {
    sendData(response, await this.dependencies.getExpense.execute(readExpenseId(request)));
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: ExpenseCreateBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.dependencies.createExpense.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly voidExpense: RequestHandler = async (request, response) => {
    const body: ExpenseVoidBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.voidExpense.execute({
        organizationId,
        actorUserId,
        allowedLocationIds,
        expenseId: readExpenseId(request),
        body,
      }),
    );
  };

  readonly listCategories: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.listCategories.execute());
  };

  readonly createCategory: RequestHandler = async (request, response) => {
    const body: ExpenseCategoryCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.createCategory.execute({ organizationId, actorUserId, body }),
      { status: HTTP_CREATED },
    );
  };

  readonly updateCategory: RequestHandler = async (request, response) => {
    const body: ExpenseCategoryUpdateBody = request.body;
    const { actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.updateCategory.execute({
        actorUserId,
        expenseCategoryId: readCategoryId(request),
        body,
      }),
    );
  };

  readonly archiveCategory: RequestHandler = async (request, response) => {
    const body = (request.body ?? {}) as ExpenseCategoryArchiveBody;
    const { actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.archiveCategory.execute({
        actorUserId,
        expenseCategoryId: readCategoryId(request),
        version: body.version,
      }),
    );
  };
}
