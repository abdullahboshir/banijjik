import type { CurrencyCode } from "@banijjik/contracts";
import { asId, newId, type MemberId, type OrganizationId, type UserId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  ApprovalTokenRecord,
  ApprovalTokenRepository,
  NewApprovalToken,
} from "../application/ports/approval-token-repository.js";
import { APPROVAL_TOKEN_MODEL_NAME, type ApprovalTokenDocument } from "./approval-token.schema.js";

function toRecord(document: ApprovalTokenDocument): ApprovalTokenRecord {
  const amount =
    document.amountMinor === undefined || document.currencyCode === undefined
      ? undefined
      : {
          amount: document.amountMinor,
          currency: document.currencyCode as CurrencyCode,
        };
  return {
    approvalTokenId: document.approvalTokenId,
    organizationId: asId<OrganizationId>(document.organizationId),
    tokenHash: document.tokenHash,
    action: document.action,
    subjectKey: document.subjectKey,
    amount,
    approverMemberId: asId<MemberId>(document.approverMemberId),
    requestedByUserId: asId<UserId>(document.requestedByUserId),
    expiresAt: document.expiresAt,
    usedAt: document.usedAt,
  };
}

export class MongoApprovalTokenRepository implements ApprovalTokenRepository {
  async insert(token: NewApprovalToken): Promise<ApprovalTokenRecord> {
    const approvalTokenId = newId();
    const document = {
      approvalTokenId,
      organizationId: token.organizationId,
      tokenHash: token.tokenHash,
      action: token.action,
      subjectKey: token.subjectKey,
      approverMemberId: token.approverMemberId,
      requestedByUserId: token.requestedByUserId,
      expiresAt: token.expiresAt,
      createdAt: token.now,
      updatedAt: token.now,
      createdByUserId: token.createdByUserId,
      updatedByUserId: null,
      ...(token.amount === undefined
        ? {}
        : { amountMinor: token.amount.amount, currencyCode: token.amount.currency }),
    };
    await this.model().create([document], sessionOption(getActiveSession()));
    return toRecord(document);
  }

  async findByHash(tokenHash: string): Promise<ApprovalTokenRecord | undefined> {
    const document = await this.model()
      .findOne({ tokenHash }, null, sessionOption(getActiveSession()))
      .lean<ApprovalTokenDocument>();
    return document === null ? undefined : toRecord(document);
  }

  async markUsed(tokenHash: string, usedAt: Date): Promise<ApprovalTokenRecord | undefined> {
    const updated = await this.model()
      .findOneAndUpdate(
        { tokenHash, usedAt: { $exists: false } },
        { $set: { usedAt, updatedAt: usedAt } },
        { returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<ApprovalTokenDocument>();
    return updated === null ? undefined : toRecord(updated);
  }

  private model() {
    return models({}).get<ApprovalTokenDocument>(APPROVAL_TOKEN_MODEL_NAME);
  }
}
