import type { OrganizationId, UserId } from "@banijjik/ids";
import { getRequestContext } from "../../../../kernel/context/index.js";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { CreditPackRepository } from "../application/ports/credit-pack-repository.js";
import type { CreditPack } from "@banijjik/contracts/credit";
import type { Money } from "@banijjik/contracts/accounting";
import { CREDIT_PACK_MODEL_NAME, type CreditPackDocument } from "./credit-pack.schema.js";

export class MongoCreditPackRepository implements CreditPackRepository {
  async insert(pack: CreditPack): Promise<void> {
    const organizationId = this.getOrganizationId();
    const Model = models({ organizationId }).get<CreditPackDocument>(CREDIT_PACK_MODEL_NAME);
    await Model.create([this.toDocument(pack, organizationId)], sessionOption(getActiveSession()));
  }

  async save(
    pack: CreditPack,
    expectedVersion: number,
    actorUserId: UserId | null,
  ): Promise<CreditPack> {
    const organizationId = this.getOrganizationId();
    const document = this.toDocument(pack, organizationId);
    const Model = models({ organizationId }).get<CreditPackDocument>(CREDIT_PACK_MODEL_NAME);
    const saved = await updateVersioned<CreditPackDocument>({
      model: Model,
      filter: { creditPackId: pack.creditPackId },
      expectedVersion,
      update: {
        $set: {
          name: document.name,
          credits: document.credits,
          price: document.price,
          validityDays: document.validityDays,
          status: document.status,
          sortOrder: document.sortOrder,
          updatedByUserId: actorUserId,
        },
      },
    });
    return this.fromDocument(saved);
  }

  async findById(organizationId: OrganizationId, creditPackId: string): Promise<CreditPack | null> {
    const Model = models({ organizationId }).get<CreditPackDocument>(CREDIT_PACK_MODEL_NAME);
    const doc = await Model.findOne({ organizationId, creditPackId });
    return doc ? this.fromDocument(doc) : null;
  }

  async listActive(organizationId: OrganizationId): Promise<readonly CreditPack[]> {
    const Model = models({ organizationId }).get<CreditPackDocument>(CREDIT_PACK_MODEL_NAME);
    const docs = await Model.find({ organizationId, status: "ACTIVE" }).sort({
      sortOrder: 1,
      createdAt: 1,
    });
    return docs.map((d: CreditPackDocument) => this.fromDocument(d));
  }

  async list(
    organizationId: OrganizationId,
    options: { limit: number; offset: number },
  ): Promise<{ readonly items: readonly CreditPack[]; readonly total: number }> {
    const Model = models({ organizationId }).get<CreditPackDocument>(CREDIT_PACK_MODEL_NAME);
    const [docs, total] = await Promise.all([
      Model.find({ organizationId })
        .sort({ sortOrder: 1, createdAt: 1 })
        .skip(options.offset)
        .limit(options.limit),
      Model.countDocuments({ organizationId }),
    ]);
    return {
      items: docs.map((d: CreditPackDocument) => this.fromDocument(d)),
      total,
    };
  }

  private getOrganizationId(): string {
    const context = getRequestContext();
    if (!context.organizationId) {
      throw new Error("Organization context required");
    }
    return context.organizationId;
  }

  private toDocument(pack: CreditPack, organizationId: string): CreditPackDocument {
    return {
      creditPackId: pack.creditPackId,
      organizationId,
      name: pack.name,
      credits: pack.credits,
      price: pack.price,
      validityDays: pack.validityDays,
      status: pack.status,
      sortOrder: pack.sortOrder,
      version: pack.version,
      createdAt: new Date(pack.createdAt),
      updatedAt: new Date(pack.updatedAt),
      createdByUserId: null,
      updatedByUserId: null,
    };
  }

  private fromDocument(doc: CreditPackDocument): CreditPack {
    return {
      creditPackId: doc.creditPackId,
      name: doc.name,
      credits: doc.credits,
      price: doc.price as Money,
      validityDays: doc.validityDays,
      status: doc.status,
      sortOrder: doc.sortOrder,
      version: doc.version,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
