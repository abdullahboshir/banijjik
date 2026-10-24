import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_EVENT_TYPE,
  COMMISSION_SOURCE_TYPE,
  type CommissionRuleSnapshot,
  type CommissionSourceType,
} from "@banijjik/contracts/commission";
import { PAYMENT_REQUEST_TYPE, type PaymentRequestType } from "@banijjik/contracts/payment";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Logger } from "../../../../kernel/logger/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { CommissionEntry } from "../domain/commission-entry.entity.js";
import type { CommissionRuleCandidate } from "../domain/resolve-commission-rule.js";
import type {
  CommissionEntryRepository,
  CommissionEventPublisher,
  CommissionMemberRoleReader,
  CommissionOfferingReader,
  CommissionOrderReader,
  CommissionPaymentReader,
  CommissionRuleRepository,
  CommissionSourceMarkRepository,
  CommissionSourceReader,
  CommissionTimezoneReader,
  CommissionUnitOfWork,
} from "./ports/commission-ports.js";

export interface AccrualDependencies {
  readonly rules: Pick<CommissionRuleRepository, "listActiveForSubjects">;
  readonly entries: Pick<CommissionEntryRepository, "insertIfAbsent" | "listBySource">;
  readonly marks: Pick<CommissionSourceMarkRepository, "touch">;
  readonly bookings: Pick<CommissionSourceReader, "readBooking">;
  readonly orders: CommissionOrderReader;
  readonly payments: CommissionPaymentReader;
  readonly offerings: CommissionOfferingReader;
  readonly memberRoles: CommissionMemberRoleReader;
  readonly timezones: CommissionTimezoneReader;
  readonly events: CommissionEventPublisher;
  readonly unitOfWork: CommissionUnitOfWork;
  readonly clock: Clock;
  readonly logger: Pick<Logger, "debug" | "warn">;
}

export interface CommissionEventContext {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
  readonly occurredAt: Date;
}

/** What a run did, so a test or a log line can tell a replay from a first run. */
export interface AccrualResult {
  readonly accruals: number;
  readonly adjustments: number;
  readonly skippedCurrency: number;
}

export const NOTHING_DONE: AccrualResult = { accruals: 0, adjustments: 0, skippedCurrency: 0 };

/** The payment request a commission source is paid under: a booking or a whole order. */
export const PAYMENT_REQUEST_OF_SOURCE: Record<CommissionSourceType, PaymentRequestType> = {
  [COMMISSION_SOURCE_TYPE.BOOKING]: PAYMENT_REQUEST_TYPE.BOOKING,
  [COMMISSION_SOURCE_TYPE.ORDER_LINE]: PAYMENT_REQUEST_TYPE.ORDER,
};

export function orderingKeyOf(memberId: string): string {
  return `commission:${memberId}`;
}

export function snapshotOf(rule: CommissionRuleCandidate): CommissionRuleSnapshot {
  return {
    commissionRuleId: rule.commissionRuleId,
    subjectType: rule.subjectType,
    targetType: rule.targetType,
    calculation: rule.calculation,
    percentBasisPoints: rule.percentBasisPoints,
    fixedAmount: rule.fixedAmount,
  };
}

export function sumOf(entries: readonly CommissionEntry[], currency: Money["currency"]): Money {
  return { amount: entries.reduce((total, entry) => total + entry.amount.amount, 0), currency };
}

export async function publishRecorded(
  dependencies: AccrualDependencies,
  entry: CommissionEntry,
): Promise<void> {
  await dependencies.events.publish(
    COMMISSION_EVENT_TYPE.ENTRY_RECORDED,
    { commissionEntryId: entry.commissionEntryId },
    { orderingKey: orderingKeyOf(entry.memberId) },
  );
}

export function addResults(left: AccrualResult, right: AccrualResult): AccrualResult {
  return {
    accruals: left.accruals + right.accruals,
    adjustments: left.adjustments + right.adjustments,
    skippedCurrency: left.skippedCurrency + right.skippedCurrency,
  };
}
