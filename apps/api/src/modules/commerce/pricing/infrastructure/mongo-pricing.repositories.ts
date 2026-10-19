import { PROMOTION_STATUS, TAX_CLASS_STATUS } from "@banijjik/contracts/pricing";
import type { PromotionId, TaxClassId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  PromotionListRequest,
  PromotionRepository,
  TaxClassListRequest,
  TaxClassRepository,
} from "../application/ports/pricing-repositories.js";
import type { Promotion } from "../domain/promotion.entity.js";
import type { TaxClass } from "../domain/tax-class.entity.js";
import { TaxClassKeyTakenError } from "../domain/errors.js";
import {
  promotionEditableFields,
  taxClassEditableFields,
  toPromotion,
  toPromotionDocument,
  toTaxClass,
  toTaxClassDocument,
} from "./pricing.mappers.js";
import {
  PROMOTION_MODEL_NAME,
  TAX_CLASS_MODEL_NAME,
  type PromotionDocument,
  type TaxClassDocument,
} from "./pricing.schemas.js";

export class MongoTaxClassRepository implements TaxClassRepository {
  async insert(taxClass: TaxClass): Promise<void> {
    try {
      await this.model().create([toTaxClassDocument(taxClass)], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new TaxClassKeyTakenError(taxClass.taxClassKey);
      throw error;
    }
  }

  async findById(taxClassId: TaxClassId): Promise<TaxClass | undefined> {
    const document = await this.model()
      .findOne({ taxClassId }, null, sessionOption(getActiveSession()))
      .lean<TaxClassDocument>();
    return document === null ? undefined : toTaxClass(document);
  }

  async findByKey(taxClassKey: string): Promise<TaxClass | undefined> {
    const document = await this.model()
      .findOne({ taxClassKey }, null, sessionOption(getActiveSession()))
      .lean<TaxClassDocument>();
    return document === null ? undefined : toTaxClass(document);
  }

  async findActiveByKeys(keys: readonly string[]): Promise<readonly TaxClass[]> {
    if (keys.length === 0) return [];
    const documents = await this.model()
      .find(
        { taxClassKey: { $in: keys }, status: TAX_CLASS_STATUS.ACTIVE },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<TaxClassDocument[]>();
    return documents.map(toTaxClass);
  }

  async update(
    taxClass: TaxClass,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<TaxClass> {
    const saved = await updateVersioned<TaxClassDocument>({
      model: this.model(),
      filter: { taxClassId: taxClass.taxClassId },
      expectedVersion,
      update: {
        $set: { ...taxClassEditableFields(taxClass), updatedByUserId: actorUserId },
      },
    });
    return toTaxClass(saved);
  }

  async list(request: TaxClassListRequest): Promise<{ items: TaxClass[]; hasNext: boolean }> {
    const { page, limit, status } = request;
    const filter = status === undefined ? {} : { status };
    const documents = await this.model()
      .find(filter, null, sessionOption(getActiveSession()))
      .sort({ name: 1, taxClassId: 1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<TaxClassDocument[]>();
    return {
      items: documents.slice(0, limit).map(toTaxClass),
      hasNext: documents.length > limit,
    };
  }

  private model() {
    return models({}).get<TaxClassDocument>(TAX_CLASS_MODEL_NAME);
  }
}

export class MongoPromotionRepository implements PromotionRepository {
  async insert(promotion: Promotion): Promise<void> {
    await this.model().create([toPromotionDocument(promotion)], sessionOption(getActiveSession()));
  }

  async findById(promotionId: PromotionId): Promise<Promotion | undefined> {
    const document = await this.model()
      .findOne({ promotionId }, null, sessionOption(getActiveSession()))
      .lean<PromotionDocument>();
    return document === null ? undefined : toPromotion(document);
  }

  async listActiveForQuote(): Promise<readonly Promotion[]> {
    const documents = await this.model()
      .find({ status: PROMOTION_STATUS.ACTIVE }, null, sessionOption(getActiveSession()))
      .lean<PromotionDocument[]>();
    return documents.map(toPromotion);
  }

  async update(
    promotion: Promotion,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Promotion> {
    const unset = {
      ...(promotion.startsAt === undefined ? { startsAt: 1 } : {}),
      ...(promotion.endsAt === undefined ? { endsAt: 1 } : {}),
      ...(promotion.minQuantity === undefined ? { minQuantity: 1 } : {}),
      ...(promotion.maxDiscountPerLine === undefined ? { maxDiscountPerLine: 1 } : {}),
    };
    const saved = await updateVersioned<PromotionDocument>({
      model: this.model(),
      filter: { promotionId: promotion.promotionId },
      expectedVersion,
      update: {
        $set: {
          ...promotionEditableFields(promotion),
          updatedByUserId: actorUserId,
          ...(promotion.startsAt === undefined ? {} : { startsAt: promotion.startsAt }),
          ...(promotion.endsAt === undefined ? {} : { endsAt: promotion.endsAt }),
          ...(promotion.minQuantity === undefined ? {} : { minQuantity: promotion.minQuantity }),
          ...(promotion.maxDiscountPerLine === undefined
            ? {}
            : { maxDiscountPerLine: promotion.maxDiscountPerLine }),
        },
        ...(Object.keys(unset).length === 0 ? {} : { $unset: unset }),
      },
    });
    return toPromotion(saved);
  }

  async list(request: PromotionListRequest): Promise<{ items: Promotion[]; hasNext: boolean }> {
    const { page, limit, status } = request;
    const filter = status === undefined ? {} : { status };
    const documents = await this.model()
      .find(filter, null, sessionOption(getActiveSession()))
      .sort({ priority: -1, name: 1, promotionId: 1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<PromotionDocument[]>();
    return {
      items: documents.slice(0, limit).map(toPromotion),
      hasNext: documents.length > limit,
    };
  }

  private model() {
    return models({}).get<PromotionDocument>(PROMOTION_MODEL_NAME);
  }
}
