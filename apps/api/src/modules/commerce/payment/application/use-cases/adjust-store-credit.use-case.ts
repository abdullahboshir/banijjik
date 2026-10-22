import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_EVENT_TYPE,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
  type Money,
  type StoreCreditDirection,
  type StoreCreditEntryResponse,
} from "@banijjik/contracts/payment";
import {
  newId,
  type ContactId,
  type OrganizationId,
  type StoreCreditEntryId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import {
  paymentApprovalRequiredError,
  recordNotFound,
  storeCreditInsufficientError,
} from "../../domain/errors.js";
import type {
  ContactStoreCreditPort,
  PaymentUnitOfWork,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";

export interface AdjustStoreCreditInput {
  readonly organizationId: OrganizationId;
  readonly contactId: ContactId;
  readonly direction: StoreCreditDirection;
  readonly amount: Money;
  readonly reason: string;
  readonly approvalToken: string;
  readonly actorUserId: UserId | null;
}

export function toStoreCreditEntryResponse(entry: StoreCreditEntry): StoreCreditEntryResponse {
  const props = entry.toProps();
  return {
    storeCreditEntryId: props.storeCreditEntryId,
    contactId: props.contactId,
    direction: props.direction,
    kind: props.kind,
    amount: props.amount,
    paymentId: props.paymentId,
    balanceAfterMinor: props.balanceAfterMinor,
    note: props.note,
    expiresAt: props.expiresAt ? props.expiresAt.toISOString() : null,
    createdAt: props.createdAt.toISOString(),
  };
}

async function adjustContactBalance(
  contactStoreCredit: ContactStoreCreditPort,
  input: AdjustStoreCreditInput,
): Promise<number> {
  const contactBal = await contactStoreCredit.getBalance(input.organizationId, input.contactId);
  if (!contactBal) throw recordNotFound();

  const delta =
    input.direction === STORE_CREDIT_DIRECTION.CREDIT ? input.amount.amount : -input.amount.amount;

  if (delta < 0 && contactBal.balanceMinor < input.amount.amount) {
    throw storeCreditInsufficientError();
  }

  const result = await contactStoreCredit.adjustBalance({
    organizationId: input.organizationId,
    contactId: input.contactId,
    deltaMinor: delta,
    expectedVersion: contactBal.version,
  });

  if (!result.success) throw storeCreditInsufficientError();
  return result.newBalanceMinor;
}

export interface AdjustStoreCreditDependencies {
  readonly storeCredit: StoreCreditRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export class AdjustStoreCreditUseCase {
  constructor(private readonly dependencies: AdjustStoreCreditDependencies) {}

  async execute(input: AdjustStoreCreditInput): Promise<StoreCreditEntryResponse> {
    const { storeCredit, contactStoreCredit, unitOfWork, approvals, events, audit, clock } =
      this.dependencies;

    if (!input.approvalToken) throw paymentApprovalRequiredError();

    return unitOfWork.run(async () => {
      await approvals.consume(input.approvalToken, {
        action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
        subjectKey: input.contactId,
        amount: input.amount,
      });

      const newBalance = await adjustContactBalance(contactStoreCredit, input);
      const now = clock.now();
      const storeCreditEntryId = newId<StoreCreditEntryId>();

      const entry = StoreCreditEntry.create({
        storeCreditEntryId,
        organizationId: input.organizationId,
        contactId: input.contactId,
        direction: input.direction,
        kind: STORE_CREDIT_ENTRY_KIND.MANUAL_ADJUSTMENT,
        amount: input.amount,
        paymentId: null,
        balanceAfterMinor: newBalance,
        note: input.reason,
        expiresAt: null,
        createdAt: now,
        createdByUserId: input.actorUserId,
      });

      await storeCredit.create(entry);
      await events.publish(
        PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
        { storeCreditEntryId },
        { orderingKey: `paymentAccount:${input.organizationId}` },
      );

      await audit.record({
        action: AUDIT_ACTION.STORE_CREDIT_ADJUSTED,
        entityType: AUDIT_ENTITY_TYPE.storeCreditEntry,
        entityId: storeCreditEntryId,
        changes: {
          direction: { to: input.direction },
          amount: { to: input.amount.amount },
          reason: { to: input.reason },
        },
      });

      return toStoreCreditEntryResponse(entry);
    });
  }
}
