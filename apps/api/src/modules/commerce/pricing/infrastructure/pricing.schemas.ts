import {
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  PROMOTION_TARGET_SCOPE,
  TAX_CLASS_STATUS,
  type Money,
  type PromotionBenefitType,
  type PromotionStatus,
  type PromotionTargetScope,
  type TaxClassStatus,
} from "@banijjik/contracts/pricing";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const TAX_CLASS_MODEL_NAME = "TaxClass";
export const TAX_CLASS_COLLECTION_NAME = "tax_classes";
export const PROMOTION_MODEL_NAME = "Promotion";
export const PROMOTION_COLLECTION_NAME = "promotions";

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface TaxClassDocument {
  taxClassId: string;
  organizationId: string;
  taxClassKey: string;
  name: string;
  rateBasisPoints: number;
  status: TaxClassStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const taxClassSchema = new Schema<TaxClassDocument>(
  {
    ...domainIdField("taxClassId"),
    organizationId: { type: String, required: true, immutable: true },
    taxClassKey: { type: String, required: true },
    name: { type: String, required: true },
    rateBasisPoints: { type: Number, required: true },
    status: { type: String, required: true, enum: Object.values(TAX_CLASS_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
taxClassSchema.index({ organizationId: 1, taxClassId: 1 }, { unique: true });
taxClassSchema.index({ organizationId: 1, taxClassKey: 1 }, { unique: true });
taxClassSchema.index({ organizationId: 1, status: 1, name: 1 });

const moneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export interface PromotionDocument {
  promotionId: string;
  organizationId: string;
  name: string;
  status: PromotionStatus;
  priority: number;
  startsAt?: Date;
  endsAt?: Date;
  locationIds: string[];
  target: { scope: PromotionTargetScope; ids: string[] };
  benefit: { type: PromotionBenefitType; value: number | MoneyDocument };
  minQuantity?: number;
  isStackable: boolean;
  maxDiscountPerLine?: MoneyDocument;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const promotionSchema = new Schema<PromotionDocument>(
  {
    ...domainIdField("promotionId"),
    organizationId: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(PROMOTION_STATUS) },
    priority: { type: Number, required: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    locationIds: { type: [String], required: true, default: [] },
    target: {
      type: new Schema(
        {
          scope: { type: String, required: true, enum: Object.values(PROMOTION_TARGET_SCOPE) },
          ids: { type: [String], required: true, default: [] },
        },
        SUB_SCHEMA_OPTIONS,
      ),
      required: true,
    },
    benefit: {
      type: new Schema(
        {
          type: { type: String, required: true, enum: Object.values(PROMOTION_BENEFIT_TYPE) },
          value: { type: Schema.Types.Mixed, required: true },
        },
        SUB_SCHEMA_OPTIONS,
      ),
      required: true,
    },
    minQuantity: { type: Number },
    isStackable: { type: Boolean, required: true },
    maxDiscountPerLine: { type: moneySchema },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
promotionSchema.index({ organizationId: 1, promotionId: 1 }, { unique: true });
promotionSchema.index({ organizationId: 1, status: 1, priority: -1, name: 1 });

export type { Money };
