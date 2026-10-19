import {
  EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT,
  EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY,
  type Money,
} from "@banijjik/contracts/accounting";
import { FILE_PURPOSE } from "@banijjik/contracts/file";
import type { OrganizationId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher, registerEventHandler } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  buildAccountingExpenseAccountWriter,
  type ExpensePostingSource,
} from "../accounting/index.js";
import { buildExpensePostingSource } from "./application/expense-posting-source.js";
import { buildExpenseSeedOnOrganizationCreatedHandler } from "./application/handlers/seed-on-organization-created.handler.js";
import {
  catchUpExpenseCategories,
  seedExpenseCategories,
} from "./application/seed-expense-categories.js";
import {
  ArchiveExpenseCategoryUseCase,
  CreateExpenseCategoryUseCase,
  UpdateExpenseCategoryUseCase,
} from "./application/use-cases/category.use-cases.js";
import {
  CreateExpenseUseCase,
  GetExpenseUseCase,
  ListExpenseCategoriesUseCase,
  ListExpensesUseCase,
  VoidExpenseUseCase,
  type AttachmentThresholdReader,
} from "./application/use-cases/expense.use-cases.js";
import {
  MongoExpenseCategoryRepository,
  MongoExpenseRepository,
} from "./infrastructure/mongo-expense.repository.js";
import { ExpenseController } from "./presentation/expense.controller.js";
import { buildExpenseTenantRouter } from "./presentation/expense-tenant.router.js";

export { expenseManifest } from "./module.manifest.js";
export { registerExpenseModels } from "./infrastructure/register-expense-models.js";
export { seedExpenseCategories, catchUpExpenseCategories };
export type { ExpensePostingSource };

export interface ExpenseTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly locations: { isActiveLocation(locationId: string): Promise<boolean> };
  readonly attachments: { isUsable(fileId: string, purpose: string): Promise<boolean> };
  readonly attachmentThreshold: AttachmentThresholdReader;
}

export function buildExpenseRouter(dependencies: ExpenseTenantDependencies): Router {
  const expenses = new MongoExpenseRepository();
  const categories = new MongoExpenseCategoryRepository();
  const unitOfWork = new MongoUnitOfWork();
  const accounts = buildAccountingExpenseAccountWriter(dependencies.clock);
  const write = {
    expenses,
    categories,
    unitOfWork,
    events: kernelEventPublisher,
    audit: dependencies.audit,
    clock: dependencies.clock,
    attachments: {
      isUsableAttachment: (fileId: string) =>
        dependencies.attachments.isUsable(fileId, FILE_PURPOSE.ATTACHMENT),
    },
    locations: dependencies.locations,
    attachmentThreshold: dependencies.attachmentThreshold,
  };
  const categoryWrite = {
    categories,
    accounts,
    unitOfWork,
    audit: dependencies.audit,
    clock: dependencies.clock,
  };
  const controller = new ExpenseController({
    listExpenses: new ListExpensesUseCase(expenses),
    getExpense: new GetExpenseUseCase(expenses),
    createExpense: new CreateExpenseUseCase(write),
    voidExpense: new VoidExpenseUseCase(write),
    listCategories: new ListExpenseCategoriesUseCase(categories),
    createCategory: new CreateExpenseCategoryUseCase(categoryWrite),
    updateCategory: new UpdateExpenseCategoryUseCase(categoryWrite),
    archiveCategory: new ArchiveExpenseCategoryUseCase(categoryWrite),
  });
  return buildExpenseTenantRouter({
    controller,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}

export function buildExpensePostingSourceAdapter(): ExpensePostingSource {
  return buildExpensePostingSource({
    expenses: new MongoExpenseRepository(),
    categories: new MongoExpenseCategoryRepository(),
  });
}

export function registerExpenseEventHandlers(clock: Clock): void {
  registerEventHandler(
    buildExpenseSeedOnOrganizationCreatedHandler({
      categories: new MongoExpenseCategoryRepository(),
      accounts: buildAccountingExpenseAccountWriter(clock),
      clock,
    }),
  );
}

/** Default threshold reader when settings are not wired (tests may override). */
export function defaultAttachmentThresholdReader(): AttachmentThresholdReader {
  return {
    async read(organizationId: OrganizationId): Promise<Money> {
      void organizationId;
      return EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT;
    },
  };
}

export { EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY };
