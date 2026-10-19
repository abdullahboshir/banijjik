import type { Money, PromotionBenefit } from "@banijjik/contracts/pricing";
import {
  asId,
  type OrganizationId,
  type PromotionId,
  type TaxClassId,
  type UserId,
} from "@banijjik/ids";
import { Promotion } from "../domain/promotion.entity.js";
import { TaxClass } from "../domain/tax-class.entity.js";
import type { MoneyDocument, PromotionDocument, TaxClassDocument } from "./pricing.schemas.js";

function toMoney(document: MoneyDocument): Money {
  return { amount: document.amount, currency: document.currency as Money["currency"] };
}

function toBenefit(document: PromotionDocument["benefit"]): PromotionBenefit {
  if (typeof document.value === "number") {
    return { type: document.type, value: document.value };
  }
  return { type: document.type, value: toMoney(document.value) };
}

export function toTaxClass(document: TaxClassDocument): TaxClass {
  return TaxClass.restore({
    taxClassId: asId<TaxClassId>(document.taxClassId),
    organizationId: asId<OrganizationId>(document.organizationId),
    taxClassKey: document.taxClassKey,
    name: document.name,
    rateBasisPoints: document.rateBasisPoints,
    status: document.status,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    createdByUserId:
      document.createdByUserId === null ? null : asId<UserId>(document.createdByUserId),
  });
}

export function toTaxClassDocument(taxClass: TaxClass): TaxClassDocument {
  return {
    taxClassId: taxClass.taxClassId,
    organizationId: taxClass.organizationId,
    taxClassKey: taxClass.taxClassKey,
    name: taxClass.name,
    rateBasisPoints: taxClass.rateBasisPoints,
    status: taxClass.status,
    version: taxClass.version,
    createdAt: taxClass.createdAt,
    updatedAt: taxClass.updatedAt,
    createdByUserId: taxClass.createdByUserId,
    updatedByUserId: null,
  };
}

export function taxClassEditableFields(taxClass: TaxClass): {
  name: string;
  rateBasisPoints: number;
  status: TaxClass["status"];
  updatedAt: Date;
} {
  return {
    name: taxClass.name,
    rateBasisPoints: taxClass.rateBasisPoints,
    status: taxClass.status,
    updatedAt: taxClass.updatedAt,
  };
}

export function toPromotion(document: PromotionDocument): Promotion {
  return Promotion.restore({
    promotionId: asId<PromotionId>(document.promotionId),
    organizationId: asId<OrganizationId>(document.organizationId),
    name: document.name,
    status: document.status,
    priority: document.priority,
    startsAt: document.startsAt,
    endsAt: document.endsAt,
    locationIds: document.locationIds,
    target: { scope: document.target.scope, ids: document.target.ids },
    benefit: toBenefit(document.benefit),
    minQuantity: document.minQuantity,
    isStackable: document.isStackable,
    maxDiscountPerLine:
      document.maxDiscountPerLine === undefined ? undefined : toMoney(document.maxDiscountPerLine),
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    createdByUserId:
      document.createdByUserId === null ? null : asId<UserId>(document.createdByUserId),
  });
}

export function toPromotionDocument(promotion: Promotion): PromotionDocument {
  return {
    promotionId: promotion.promotionId,
    organizationId: promotion.organizationId,
    name: promotion.name,
    status: promotion.status,
    priority: promotion.priority,
    ...(promotion.startsAt === undefined ? {} : { startsAt: promotion.startsAt }),
    ...(promotion.endsAt === undefined ? {} : { endsAt: promotion.endsAt }),
    locationIds: [...promotion.locationIds],
    target: { scope: promotion.target.scope, ids: [...promotion.target.ids] },
    benefit: {
      type: promotion.benefit.type,
      value:
        typeof promotion.benefit.value === "number"
          ? promotion.benefit.value
          : { ...promotion.benefit.value },
    },
    ...(promotion.minQuantity === undefined ? {} : { minQuantity: promotion.minQuantity }),
    isStackable: promotion.isStackable,
    ...(promotion.maxDiscountPerLine === undefined
      ? {}
      : { maxDiscountPerLine: { ...promotion.maxDiscountPerLine } }),
    version: promotion.version,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
    createdByUserId: promotion.createdByUserId,
    updatedByUserId: null,
  };
}

export function promotionEditableFields(promotion: Promotion): {
  name: string;
  status: Promotion["status"];
  priority: number;
  locationIds: string[];
  target: { scope: Promotion["target"]["scope"]; ids: string[] };
  benefit: PromotionBenefit;
  isStackable: boolean;
  updatedAt: Date;
} {
  return {
    name: promotion.name,
    status: promotion.status,
    priority: promotion.priority,
    locationIds: [...promotion.locationIds],
    target: { scope: promotion.target.scope, ids: [...promotion.target.ids] },
    benefit: {
      type: promotion.benefit.type,
      value:
        typeof promotion.benefit.value === "number"
          ? promotion.benefit.value
          : { ...promotion.benefit.value },
    },
    isStackable: promotion.isStackable,
    updatedAt: promotion.updatedAt,
  };
}
