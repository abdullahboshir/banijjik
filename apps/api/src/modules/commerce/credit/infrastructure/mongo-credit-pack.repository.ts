import type { OrganizationId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { CreditPackRepository } from "../application/ports/credit-pack-repository.js";
import type { CreditPack } from "../domain/credit-pack.entity.js";
import { CREDIT_PACK_MODEL_NAME, type CreditPackDocument } from "./credit-pack.schema.js";

export class MongoCreditPackRepository implements CreditPackRepository {
  async insert(pack: CreditPack): Promise<void> {
    await this.model().create([this.toDocument(pack)], sessionOption(getActiveSession()));
  }

  async save(
    pack: CreditPack,
    expectedVersion: number,
    actorUserId: UserId | null,
  ): Promise<CreditPack> {
    const document = this.toDocument(pack);
    const saved = await updateVersioned<CreditPackDocument>({
      model: this.model(),
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
    const doc = await this.model().findOne({ organizationId, creditPackId });
    return doc ? this.fromDocument(doc) : null;
  }

  async listActive(organizationId: OrganizationId): Promise<readonly CreditPack[]> {
    const docs = await this.model()
      .find({ organizationId, status: "ACTIVE" })
      .sort({ sortOrder: 1, createdAt: 1 });
    return docs.map((d) => this.fromDocument(d));
  }

  private model() {
    return models(CREDIT_PACK_MODEL_NAME);
  }

  private toDocument(pack: CreditPack): CreditPackDocument {
    return {
      creditPackId: pack.creditPackId,
      organizationId: pack.organizationId,
      name: pack.name,
      credits: pack.credits,
      price: pack.price,
      validityDays: pack.validityDays,
      status: pack.status,
      sortOrder: pack.sortOrder,
      version: pack.version,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
      createdByUserId: null,
      updatedByUserId: null,
    };
  }

  private fromDocument(doc: CreditPackDocument): CreditPack {
    return {
      creditPackId: doc.creditPackId,
      organizationId: doc.organizationId as OrganizationId,
      name: doc.name,
      credits: doc.credits,
      price: doc.price,
      validityDays: doc.validityDays,
      status: doc.status,
      sortOrder: doc.sortOrder,
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
