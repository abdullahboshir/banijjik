import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CLOSED_REQUEST_REVERSAL_POLICY,
  PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
  type ClosedRequestReversalPolicy,
  type PaymentAllocation,
  type PaymentWriteOff,
} from "@banijjik/contracts/payment";
import type { OrganizationId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { PaymentSummaryRepository } from "../ports/payment-repositories.js";

export interface RestoreAllocationsDependencies {
  readonly summaries: PaymentSummaryRepository;
  readonly orgConfig: OrgConfigService;
  readonly audit: AuditRecorder;
}

async function readClosedRequestPolicy(
  orgConfig: OrgConfigService,
  organizationId: OrganizationId,
): Promise<ClosedRequestReversalPolicy> {
  const effective = await orgConfig.forOrganization(organizationId);
  const value = effective.config.settings[PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY];
  return value === CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF
    ? CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF
    : CLOSED_REQUEST_REVERSAL_POLICY.REOPEN_DUE;
}

/**
 * Forgives what a closed request kept. The amount is computed from the stored summary after the
 * restore, never from the request, so it can never exceed what the closure kept (ADR-140).
 */
async function writeOffClosedRequest(input: {
  readonly summaries: PaymentSummaryRepository;
  readonly organizationId: OrganizationId;
  readonly allocation: PaymentAllocation;
  readonly now: Date;
}): Promise<PaymentWriteOff | null> {
  const { summaries, organizationId, allocation, now } = input;
  const summary = await summaries.findByRequest(
    organizationId,
    allocation.requestType,
    allocation.requestId,
  );
  if (summary === undefined || summary.closedAt === null) return null;
  const netPaid = summary.allocated.amount - summary.refunded.amount;
  const written = summary.total.amount - netPaid;
  if (written <= 0) return null;
  await summaries.closeAtTotal({
    organizationId,
    requestType: allocation.requestType,
    requestId: allocation.requestId,
    total: { amount: netPaid, currency: summary.total.currency },
    now,
  });
  return {
    requestType: allocation.requestType,
    requestId: allocation.requestId,
    amount: { amount: written, currency: summary.total.currency },
  };
}

/**
 * Takes the reversed payment's allocations back off the summaries. With the WRITE_OFF policy a
 * closed request also drops what the closure kept; an open request always reopens its due.
 * Runs inside the reversal transaction.
 */
export async function restoreAllocationsForReversal(input: {
  readonly deps: RestoreAllocationsDependencies;
  readonly organizationId: OrganizationId;
  readonly allocations: readonly PaymentAllocation[];
  readonly now: Date;
}): Promise<readonly PaymentWriteOff[]> {
  const { deps, organizationId, allocations, now } = input;
  const policy = await readClosedRequestPolicy(deps.orgConfig, organizationId);
  const writeOffs: PaymentWriteOff[] = [];
  for (const allocation of allocations) {
    await deps.summaries.restoreAllocation({
      organizationId,
      requestType: allocation.requestType,
      requestId: allocation.requestId,
      amount: allocation.amount.amount,
      now,
    });
    if (policy !== CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF) continue;
    const writeOff = await writeOffClosedRequest({
      summaries: deps.summaries,
      organizationId,
      allocation,
      now,
    });
    if (writeOff !== null) writeOffs.push(writeOff);
  }
  return writeOffs;
}

export async function recordWriteOffAudits(
  audit: AuditRecorder,
  reversalPaymentId: string,
  writeOffs: readonly PaymentWriteOff[],
): Promise<void> {
  for (const writeOff of writeOffs) {
    await audit.record({
      action: AUDIT_ACTION.PAYMENT_DUE_WRITTEN_OFF,
      entityType: AUDIT_ENTITY_TYPE.payment,
      entityId: reversalPaymentId,
      changes: {
        requestType: { to: writeOff.requestType },
        requestId: { to: writeOff.requestId },
        writtenOffMinor: { to: writeOff.amount.amount },
        currency: { to: writeOff.amount.currency },
      },
    });
  }
}
