import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, type AuditAction } from "@banijjik/contracts";
import {
  CONTACT_EVENT_TYPE,
  type ContactEventType,
  type CustomerAccountResponse,
} from "@banijjik/contracts/contact";
import type { ContactId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { CustomerAccount } from "../../domain/customer-account.entity.js";
import { customerAccountNotFound } from "../../domain/errors.js";
import type {
  CustomerAccountRepository,
  CustomerSessionRepository,
} from "../ports/customer-account-ports.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface CustomerAccountStaffDependencies {
  readonly accounts: CustomerAccountRepository;
  readonly sessions: CustomerSessionRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface CustomerAccountChangeInput {
  readonly contactId: ContactId;
  readonly version: number;
  readonly actorUserId: UserId;
}

export function viewCustomerAccount(account: CustomerAccount): CustomerAccountResponse {
  return {
    customerAccountId: account.customerAccountId,
    contactId: account.contactId,
    status: account.status,
    verifiedAt: account.verifiedAt.toISOString(),
    lastLoginAt: account.lastLoginAt.toISOString(),
    blockedAt: account.blockedAt?.toISOString() ?? null,
    version: account.version,
  };
}

/** What staff see of a contact's website login; a contact that never signed in has none (404). */
export class GetCustomerAccountUseCase {
  constructor(private readonly dependencies: Pick<CustomerAccountStaffDependencies, "accounts">) {}

  async execute(contactId: ContactId): Promise<CustomerAccountResponse> {
    const account = await this.dependencies.accounts.findByContactId(contactId);
    if (account === undefined) throw customerAccountNotFound();
    return viewCustomerAccount(account);
  }
}

async function recordChange(
  dependencies: CustomerAccountStaffDependencies,
  change: {
    readonly before: CustomerAccount;
    readonly after: CustomerAccount;
    readonly action: AuditAction;
    readonly eventType: ContactEventType;
  },
): Promise<void> {
  const { after } = change;
  await dependencies.audit.record({
    action: change.action,
    entityType: AUDIT_ENTITY_TYPE.customerAccount,
    entityId: after.customerAccountId,
    changes: { status: { from: change.before.status, to: after.status } },
  });
  await dependencies.events.publish(change.eventType, {
    customerAccountId: after.customerAccountId,
    contactId: after.contactId,
  });
}

/** A blocked account cannot sign in and loses every session in the same transaction (ADR-119). */
export class BlockCustomerAccountUseCase {
  constructor(private readonly dependencies: CustomerAccountStaffDependencies) {}

  execute(input: CustomerAccountChangeInput): Promise<CustomerAccountResponse> {
    const { accounts, sessions, unitOfWork, clock } = this.dependencies;
    return unitOfWork.run(async () => {
      const before = await accounts.findByContactId(input.contactId);
      if (before === undefined) throw customerAccountNotFound();
      const after = await accounts.save(
        before.block(input.actorUserId, clock.now()),
        input.version,
        input.actorUserId,
      );
      await sessions.deleteAllOfAccount(after.customerAccountId);
      await recordChange(this.dependencies, {
        before,
        after,
        action: AUDIT_ACTION.CUSTOMER_ACCOUNT_BLOCKED,
        eventType: CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_BLOCKED,
      });
      return viewCustomerAccount(after);
    });
  }
}

export class UnblockCustomerAccountUseCase {
  constructor(private readonly dependencies: CustomerAccountStaffDependencies) {}

  execute(input: CustomerAccountChangeInput): Promise<CustomerAccountResponse> {
    const { accounts, unitOfWork } = this.dependencies;
    return unitOfWork.run(async () => {
      const before = await accounts.findByContactId(input.contactId);
      if (before === undefined) throw customerAccountNotFound();
      const after = await accounts.save(before.unblock(), input.version, input.actorUserId);
      await recordChange(this.dependencies, {
        before,
        after,
        action: AUDIT_ACTION.CUSTOMER_ACCOUNT_UNBLOCKED,
        eventType: CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_UNBLOCKED,
      });
      return viewCustomerAccount(after);
    });
  }
}
