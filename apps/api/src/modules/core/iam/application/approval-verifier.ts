import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { ApprovalAction } from "@banijjik/contracts/iam";
import type { MemberId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { approvalRequired } from "../domain/errors.js";
import type { ApprovalTokenSecrets } from "./ports/approval-token-secrets.js";
import type { ApprovalMoney, ApprovalTokenRepository } from "./ports/approval-token-repository.js";

export interface ApprovalConsumeExpected {
  readonly action: ApprovalAction;
  readonly subjectKey: string;
  readonly requestedByUserId?: string;
  readonly locationId?: string;
  /** When set, the token's amount must cover it (same currency). */
  readonly amount?: ApprovalMoney;
}

export interface ApprovalConsumeResult {
  readonly approvalTokenId: string;
  readonly approverMemberId: MemberId;
  readonly approvedAt: Date;
}

export interface ApprovalVerifierDependencies {
  readonly tokens: ApprovalTokenRepository;
  readonly tokenSecrets: ApprovalTokenSecrets;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/**
 * Consumes a one-time approval token inside the caller's transaction (ADR-121).
 * Other modules import this through iam's index.
 */
export class ApprovalVerifier {
  constructor(private readonly dependencies: ApprovalVerifierDependencies) {}

  async consume(token: string, expected: ApprovalConsumeExpected): Promise<ApprovalConsumeResult> {
    const { tokens, tokenSecrets, audit, clock } = this.dependencies;
    const tokenHash = tokenSecrets.hash(token);
    const stored = await tokens.findByHash(tokenHash);
    if (stored === undefined) throw approvalRequired(expected.action);
    if (stored.usedAt !== undefined) throw approvalRequired(expected.action);
    const now = clock.now();
    if (stored.expiresAt.getTime() <= now.getTime()) throw approvalRequired(expected.action);
    if (stored.action !== expected.action) throw approvalRequired(expected.action);
    if (stored.subjectKey !== expected.subjectKey) throw approvalRequired(expected.action);
    assertCallerBinding(stored, expected);
    if (!amountIsCovered(stored.amount, expected.amount)) {
      throw approvalRequired(expected.action);
    }
    const marked = await tokens.markUsed(tokenHash, now);
    if (marked === undefined) throw approvalRequired(expected.action);
    await audit.record({
      action: AUDIT_ACTION.APPROVAL_USED,
      entityType: AUDIT_ENTITY_TYPE.approvalToken,
      entityId: marked.approvalTokenId,
      changes: {
        action: { to: expected.action },
        subjectKey: { to: expected.subjectKey },
        approverMemberId: { to: marked.approverMemberId },
      },
    });
    return {
      approvalTokenId: marked.approvalTokenId,
      approverMemberId: marked.approverMemberId,
      approvedAt: now,
    };
  }
}

/** A lower or equal amount passes; a higher amount or currency mismatch fails. */
function amountIsCovered(
  approved: ApprovalMoney | undefined,
  requested: ApprovalMoney | undefined,
): boolean {
  if (requested === undefined) return approved === undefined;
  if (approved === undefined) return false;
  if (approved.currency !== requested.currency) return false;
  return requested.amount <= approved.amount;
}

function assertCallerBinding(
  stored: { locationId?: string; requestedByUserId: string },
  expected: ApprovalConsumeExpected,
): void {
  if (expected.locationId !== undefined && stored.locationId !== expected.locationId)
    throw approvalRequired(expected.action);
  if (
    expected.requestedByUserId !== undefined &&
    stored.requestedByUserId !== expected.requestedByUserId
  )
    throw approvalRequired(expected.action);
}
