import type { CustomerAccountId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { findRequestContext } from "../../../kernel/context/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  BlockCustomerAccountUseCase,
  type CustomerAccountStaffDependencies,
} from "./application/use-cases/customer-account-staff.use-cases.js";
import { customerAccountNotFound } from "./domain/errors.js";
import { MongoCustomerAccountRepository } from "./infrastructure/mongo-customer-account.repository.js";
import { MongoCustomerSessionRepository } from "./infrastructure/mongo-customer-session.repository.js";

export interface CustomerAccountBlockerInput {
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
  readonly actorUserId: UserId;
}

/**
 * Blocks a customer account for another module (M.7 decision 7: resolving a report with
 * ACCOUNT_BLOCKED). It runs the staff block use case, so the entity transition, the session
 * deletion, the audit entry and the event are the same ones the staff screen produces, and the
 * nested unit of work joins the transaction the caller opened. An already blocked account answers
 * without a write, so a rerun of the same request is harmless.
 */
export async function blockCustomerAccount(
  dependencies: CustomerAccountStaffDependencies,
  input: CustomerAccountBlockerInput,
): Promise<void> {
  const context = findRequestContext();
  if (context?.organizationId !== input.organizationId) throw customerAccountNotFound();
  const account = await dependencies.accounts.findById(input.customerAccountId);
  if (account === undefined) throw customerAccountNotFound();
  if (!account.isActive()) return;
  await new BlockCustomerAccountUseCase(dependencies).execute({
    contactId: account.contactId,
    version: account.version,
    actorUserId: input.actorUserId,
  });
}

/** The staff ports of a ban, built here so another module never reaches into the contact module. */
export function buildCustomerAccountBlocker(ports: {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}): {
  block(input: CustomerAccountBlockerInput): Promise<void>;
} {
  const staff: CustomerAccountStaffDependencies = {
    accounts: new MongoCustomerAccountRepository(),
    sessions: new MongoCustomerSessionRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    ...ports,
  };
  return { block: (input) => blockCustomerAccount(staff, input) };
}
