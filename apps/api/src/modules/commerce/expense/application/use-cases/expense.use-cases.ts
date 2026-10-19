import {
  EXPENSE_EVENT_TYPE,
  MAX_EXPENSE_ATTACHMENTS,
  type ExpenseCategoryResponse,
  type ExpenseResponse,
  type Money,
} from "@banijjik/contracts/accounting";
import { AUDIT_ACTION, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  asId,
  type ExpenseCategoryId,
  type ExpenseId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type {
  ExpenseCreateBody,
  ExpenseListQuery,
  ExpenseVoidBody,
} from "@banijjik/validation/accounting";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { Expense } from "../../domain/expense.entity.js";
import {
  attachmentRequired,
  categoryArchived,
  invalidAttachment,
  locationForbidden,
  recordNotFound,
  tooManyAttachments,
} from "../../domain/errors.js";
import { toCategoryResponse, toExpenseResponse } from "../expense-views.js";
import type {
  ExpenseCategoryRepository,
  ExpenseRepository,
} from "../ports/expense-repositories.js";

export interface ExpenseEventPublisher {
  publish(
    type: (typeof EXPENSE_EVENT_TYPE)[keyof typeof EXPENSE_EVENT_TYPE],
    payload: { readonly expenseId: string },
    options: { readonly orderingKey: string },
  ): Promise<void>;
}

export interface AttachmentChecker {
  isUsableAttachment(fileId: string): Promise<boolean>;
}

export interface LocationChecker {
  isActiveLocation(locationId: string): Promise<boolean>;
}

export interface AttachmentThresholdReader {
  read(organizationId: OrganizationId): Promise<Money>;
}

export interface ExpenseUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface ExpenseWriteDependencies {
  readonly expenses: ExpenseRepository;
  readonly categories: ExpenseCategoryRepository;
  readonly unitOfWork: ExpenseUnitOfWork;
  readonly events: ExpenseEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly attachments: AttachmentChecker;
  readonly locations: LocationChecker;
  readonly attachmentThreshold: AttachmentThresholdReader;
}

function orderingKey(organizationId: string): string {
  return `expenseAccount:${organizationId}`;
}

function formatExpenseNumber(value: number): string {
  return String(value).padStart(6, "0");
}

function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}

export class ListExpensesUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(
    query: ExpenseListQuery,
  ): Promise<{ readonly items: ExpenseResponse[]; readonly hasNext: boolean }> {
    const result = await this.expenses.list(query);
    return { items: result.items.map(toExpenseResponse), hasNext: result.hasNext };
  }
}

export class GetExpenseUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(expenseId: ExpenseId): Promise<ExpenseResponse> {
    const expense = await this.expenses.findById(expenseId);
    if (expense === undefined) throw recordNotFound();
    return toExpenseResponse(expense);
  }
}

async function assertCreatePreconditions(
  dependencies: ExpenseWriteDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly body: ExpenseCreateBody;
  },
): Promise<{ readonly expenseCategoryId: ExpenseCategoryId }> {
  const { body } = input;
  assertLocationAllowed(body.locationId, input.allowedLocationIds);
  if (body.attachmentFileIds.length > MAX_EXPENSE_ATTACHMENTS) throw tooManyAttachments();
  if (!(await dependencies.locations.isActiveLocation(body.locationId))) {
    throw locationForbidden();
  }
  for (const fileId of body.attachmentFileIds) {
    if (!(await dependencies.attachments.isUsableAttachment(fileId))) {
      throw invalidAttachment();
    }
  }
  const category = await dependencies.categories.findById(
    asId<ExpenseCategoryId>(body.expenseCategoryId),
  );
  if (category === undefined) throw recordNotFound();
  if (!category.isActive) throw categoryArchived();
  const threshold = await dependencies.attachmentThreshold.read(input.organizationId);
  if (
    threshold.amount > 0 &&
    body.amount.amount > threshold.amount &&
    body.attachmentFileIds.length === 0
  ) {
    throw attachmentRequired();
  }
  return { expenseCategoryId: category.expenseCategoryId };
}

export class CreateExpenseUseCase {
  constructor(private readonly dependencies: ExpenseWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly body: ExpenseCreateBody;
  }): Promise<ExpenseResponse> {
    const { body } = input;
    const { expenseCategoryId } = await assertCreatePreconditions(this.dependencies, input);
    const expense = await this.dependencies.unitOfWork.run(async () => {
      const number = await nextSequenceValue({
        organizationId: input.organizationId,
        sequenceKey: SEQUENCE_KEY.EXPENSE,
      });
      const created = Expense.create({
        organizationId: input.organizationId,
        expenseNumber: formatExpenseNumber(number),
        expenseCategoryId,
        amount: body.amount,
        paidVia: body.paidVia,
        businessDate: body.businessDate,
        locationId: asId<LocationId>(body.locationId),
        note: body.note ?? null,
        attachmentFileIds: body.attachmentFileIds,
        customFields: body.customFields ?? {},
        now: this.dependencies.clock.now(),
        actorUserId: input.actorUserId,
      });
      await this.dependencies.expenses.insert(created);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.EXPENSE_CREATED,
        entityType: "expense",
        entityId: created.expenseId,
        changes: { expenseNumber: { to: created.expenseNumber } },
      });
      await this.dependencies.events.publish(
        EXPENSE_EVENT_TYPE.EXPENSE_POSTED,
        { expenseId: created.expenseId },
        { orderingKey: orderingKey(input.organizationId) },
      );
      return created;
    });
    return toExpenseResponse(expense);
  }
}

export class VoidExpenseUseCase {
  constructor(private readonly dependencies: ExpenseWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly expenseId: ExpenseId;
    readonly body: ExpenseVoidBody;
  }): Promise<ExpenseResponse> {
    const existing = await this.dependencies.expenses.findById(input.expenseId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const voided = existing.void(
      input.body.reason,
      this.dependencies.clock.now(),
      input.actorUserId,
    );
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.expenses.save(voided, input.body.version);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.EXPENSE_VOIDED,
        entityType: "expense",
        entityId: voided.expenseId,
        changes: { status: { from: existing.status, to: voided.status } },
      });
      await this.dependencies.events.publish(
        EXPENSE_EVENT_TYPE.EXPENSE_VOIDED,
        { expenseId: voided.expenseId },
        { orderingKey: orderingKey(input.organizationId) },
      );
    });
    return toExpenseResponse(voided);
  }
}

export class ListExpenseCategoriesUseCase {
  constructor(private readonly categories: ExpenseCategoryRepository) {}

  async execute(): Promise<readonly ExpenseCategoryResponse[]> {
    return (await this.categories.list()).map(toCategoryResponse);
  }
}
