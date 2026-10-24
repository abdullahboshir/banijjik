import type {
  CommissionEntryResponse,
  CommissionPayoutResponse,
  CommissionRuleResponse,
} from "@banijjik/contracts/commission";
import type { CommissionEntry } from "../domain/commission-entry.entity.js";
import type { CommissionPayout } from "../domain/commission-payout.entity.js";
import type { CommissionRule } from "../domain/commission-rule.entity.js";

export function toRuleResponse(rule: CommissionRule): CommissionRuleResponse {
  const props = rule.toProps();
  return {
    commissionRuleId: props.commissionRuleId,
    subjectType: props.subjectType,
    memberId: props.memberId,
    roleId: props.roleId,
    targetType: props.targetType,
    offeringKind: props.offeringKind,
    categoryId: props.categoryId,
    offeringId: props.offeringId,
    calculation: props.calculation,
    percentBasisPoints: props.percentBasisPoints,
    fixedAmount: props.fixedAmount,
    status: props.status,
    version: props.version,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}

export function toEntryResponse(
  entry: CommissionEntry,
  memberNames: ReadonlyMap<string, string>,
): CommissionEntryResponse {
  return {
    commissionEntryId: entry.commissionEntryId,
    memberId: entry.memberId,
    memberName: memberNames.get(entry.memberId) ?? "",
    locationId: entry.locationId,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    sourceNumber: entry.sourceNumber,
    sequence: entry.sequence,
    entryKind: entry.entryKind,
    amount: entry.amount,
    base: entry.base,
    sourceGrossTotal: entry.sourceGrossTotal,
    ruleSnapshot: entry.ruleSnapshot,
    businessDate: entry.businessDate,
    payoutId: entry.payoutId,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toPayoutResponse(payout: CommissionPayout): CommissionPayoutResponse {
  return {
    commissionPayoutId: payout.commissionPayoutId,
    payoutNumber: payout.payoutNumber,
    memberId: payout.memberId,
    locationId: payout.locationId,
    upToBusinessDate: payout.upToBusinessDate,
    entryCount: payout.entryCount,
    total: payout.total,
    method: payout.method,
    externalReference: payout.externalReference,
    note: payout.note,
    businessDate: payout.businessDate,
    createdAt: payout.createdAt.toISOString(),
  };
}
