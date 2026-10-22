import type { CreditPurchaseMethod } from "@banijjik/contracts/credit";
import { CREDIT_PURCHASE_STATUS } from "@banijjik/contracts/credit";
import {
  asId,
  type CreditPurchaseId,
  type CustomerAccountId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { escapeRegExp } from "@banijjik/validation";
import { getRequestContext } from "../../../../kernel/context/index.js";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  CreditPurchaseRepository,
  ListCreditPurchasesStaffFilter,
} from "../application/ports/credit-purchase-repository.js";
import { CreditPurchase } from "../domain/credit-purchase.entity.js";
import { CreditReferenceTakenError } from "../domain/errors.js";
import {
  CREDIT_PURCHASE_MODEL_NAME,
  type CreditPurchaseDocument,
} from "./credit-purchase.schema.js";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export class MongoCreditPurchaseRepository implements CreditPurchaseRepository {
  async insert(purchase: CreditPurchase): Promise<void> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    try {
      await Model.create(
        [this.toDocument(purchase, organizationId)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CreditReferenceTakenError();
      }
      throw error;
    }
  }

  async updateVersioned(purchase: CreditPurchase, updatedByUserId: UserId | null): Promise<void> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    const doc = this.toDocument(purchase, organizationId);
    await updateVersioned<CreditPurchaseDocument>({
      model: Model,
      filter: { creditPurchaseId: purchase.creditPurchaseId },
      expectedVersion: purchase.version - 1,
      update: {
        $set: {
          status: doc.status,
          verifiedByUserId: doc.verifiedByUserId,
          verifiedAt: doc.verifiedAt,
          rejectionReason: doc.rejectionReason,
          creditEntryId: doc.creditEntryId,
          updatedAt: doc.updatedAt,
          updatedByUserId,
        },
      },
    });
  }

  async findById(creditPurchaseId: CreditPurchaseId): Promise<CreditPurchase | undefined> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    const doc = await Model.findOne({ organizationId, creditPurchaseId }, { _id: 0 })
      .session(getActiveSession() ?? null)
      .lean<CreditPurchaseDocument>();
    return doc ? this.fromDocument(doc) : undefined;
  }

  async findByReference(
    method: CreditPurchaseMethod,
    reference: string,
  ): Promise<CreditPurchase | undefined> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    const doc = await Model.findOne(
      {
        organizationId,
        method,
        transactionReference: reference,
        status: {
          $in: [CREDIT_PURCHASE_STATUS.PENDING, CREDIT_PURCHASE_STATUS.VERIFIED],
        },
      },
      { _id: 0 },
    )
      .session(getActiveSession() ?? null)
      .lean<CreditPurchaseDocument>();
    return doc ? this.fromDocument(doc) : undefined;
  }

  async listByAccount(
    customerAccountId: CustomerAccountId,
    offset: number,
    limit: number,
  ): Promise<{ readonly items: readonly CreditPurchase[]; readonly total: number }> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    const filter = { organizationId, customerAccountId };
    const [docs, total] = await Promise.all([
      Model.find(filter, { _id: 0 })
        .sort({ submittedAt: -1, creditPurchaseId: -1 })
        .skip(offset)
        .limit(limit)
        .session(getActiveSession() ?? null)
        .lean<CreditPurchaseDocument[]>(),
      Model.countDocuments(filter).session(getActiveSession() ?? null),
    ]);
    return {
      items: docs.map((d) => this.fromDocument(d)),
      total,
    };
  }

  async countPendingByAccount(customerAccountId: CustomerAccountId): Promise<number> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    return Model.countDocuments({
      organizationId,
      customerAccountId,
      status: CREDIT_PURCHASE_STATUS.PENDING,
    }).session(getActiveSession() ?? null);
  }

  async listForStaff(
    filter: ListCreditPurchasesStaffFilter,
  ): Promise<{ readonly items: readonly CreditPurchase[]; readonly total: number }> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );

    const query: Record<string, unknown> = { organizationId };
    if (filter.status !== undefined) {
      query["status"] = filter.status;
    }
    if (filter.q !== undefined && filter.q.trim() !== "") {
      const q = filter.q.trim().toUpperCase();
      query["$or"] = [
        { transactionReference: { $regex: `^${escapeRegExp(q)}` } },
        { purchaseNumber: { $regex: `^${escapeRegExp(q)}` } },
      ];
    }

    // Oldest PENDING first when status is PENDING, otherwise newest first
    const sort: Record<string, 1 | -1> =
      filter.status === CREDIT_PURCHASE_STATUS.PENDING
        ? { submittedAt: 1, creditPurchaseId: 1 }
        : { submittedAt: -1, creditPurchaseId: -1 };

    const [docs, total] = await Promise.all([
      Model.find(query, { _id: 0 })
        .sort(sort)
        .skip(filter.offset)
        .limit(filter.limit)
        .session(getActiveSession() ?? null)
        .lean<CreditPurchaseDocument[]>(),
      Model.countDocuments(query).session(getActiveSession() ?? null),
    ]);

    return {
      items: docs.map((d) => this.fromDocument(d)),
      total,
    };
  }

  async listExpiredPending(now: Date): Promise<readonly CreditPurchase[]> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPurchaseDocument>(
      CREDIT_PURCHASE_MODEL_NAME,
    );
    const docs = await Model.find(
      {
        organizationId,
        status: CREDIT_PURCHASE_STATUS.PENDING,
        expiresAt: { $lte: now },
      },
      { _id: 0 },
    )
      .session(getActiveSession() ?? null)
      .lean<CreditPurchaseDocument[]>();
    return docs.map((d) => this.fromDocument(d));
  }

  private getOrganizationId(): OrganizationId {
    const context = getRequestContext();
    if (!context.organizationId) {
      throw new Error("Organization context required");
    }
    return context.organizationId as OrganizationId;
  }

  private toDocument(purchase: CreditPurchase, organizationId: string): CreditPurchaseDocument {
    return {
      creditPurchaseId: purchase.creditPurchaseId,
      organizationId,
      purchaseNumber: purchase.purchaseNumber,
      customerAccountId: purchase.customerAccountId,
      creditPackId: purchase.creditPackId,
      snapshot: purchase.snapshot,
      method: purchase.method,
      senderPhoneE164: purchase.senderPhoneE164,
      transactionReference: purchase.transactionReference,
      status: purchase.status,
      verifiedByUserId: purchase.verifiedByUserId,
      verifiedAt: purchase.verifiedAt,
      rejectionReason: purchase.rejectionReason,
      creditEntryId: purchase.creditEntryId,
      submittedAt: purchase.submittedAt,
      expiresAt: purchase.expiresAt,
      version: purchase.version,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
      // A customer submission has no staff author; staff set updatedByUserId on verify/reject.
      createdByUserId: null,
      updatedByUserId: null,
    };
  }

  private fromDocument(doc: CreditPurchaseDocument): CreditPurchase {
    return CreditPurchase.restore({
      creditPurchaseId: asId<CreditPurchaseId>(doc.creditPurchaseId),
      organizationId: asId<OrganizationId>(doc.organizationId),
      purchaseNumber: doc.purchaseNumber,
      customerAccountId: asId<CustomerAccountId>(doc.customerAccountId),
      creditPackId: doc.creditPackId,
      snapshot: doc.snapshot,
      method: doc.method,
      senderPhoneE164: doc.senderPhoneE164,
      transactionReference: doc.transactionReference,
      status: doc.status,
      verifiedByUserId: doc.verifiedByUserId,
      verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt) : null,
      rejectionReason: doc.rejectionReason,
      creditEntryId: doc.creditEntryId,
      submittedAt: new Date(doc.submittedAt),
      expiresAt: new Date(doc.expiresAt),
      version: doc.version,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    });
  }
}
