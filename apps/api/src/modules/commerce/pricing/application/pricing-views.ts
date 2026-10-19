import { AUDIT_ENTITY_TYPE, type AuditAction, type AuditChanges } from "@banijjik/contracts";
import type { PromotionResponse, TaxClassResponse } from "@banijjik/contracts/pricing";
import { PRICING_EVENT_TYPE } from "@banijjik/contracts/pricing";
import { diffAuditFields, type AuditFields } from "../../../../kernel/audit/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { kernelEventPublisher } from "../../../../kernel/events/index.js";
import type { Promotion } from "../domain/promotion.entity.js";
import type { TaxClass } from "../domain/tax-class.entity.js";

export function viewTaxClass(taxClass: TaxClass): TaxClassResponse {
  return {
    taxClassId: taxClass.taxClassId,
    taxClassKey: taxClass.taxClassKey,
    name: taxClass.name,
    rateBasisPoints: taxClass.rateBasisPoints,
    status: taxClass.status,
    version: taxClass.version,
    createdAt: taxClass.createdAt.toISOString(),
    updatedAt: taxClass.updatedAt.toISOString(),
  };
}

export function viewPromotion(promotion: Promotion): PromotionResponse {
  return {
    promotionId: promotion.promotionId,
    name: promotion.name,
    status: promotion.status,
    priority: promotion.priority,
    startsAt: promotion.startsAt?.toISOString() ?? null,
    endsAt: promotion.endsAt?.toISOString() ?? null,
    locationIds: promotion.locationIds,
    target: { scope: promotion.target.scope, ids: promotion.target.ids },
    benefit: promotion.benefit,
    minQuantity: promotion.minQuantity ?? null,
    isStackable: promotion.isStackable,
    maxDiscountPerLine: promotion.maxDiscountPerLine ?? null,
    version: promotion.version,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  };
}

function taxClassFields(taxClass: TaxClass | undefined): AuditFields {
  if (taxClass === undefined) return {};
  return {
    taxClassKey: taxClass.taxClassKey,
    name: taxClass.name,
    rateBasisPoints: taxClass.rateBasisPoints,
    status: taxClass.status,
  };
}

function promotionFields(promotion: Promotion | undefined): AuditFields {
  if (promotion === undefined) return {};
  return {
    name: promotion.name,
    status: promotion.status,
    priority: promotion.priority,
    startsAt: promotion.startsAt?.toISOString(),
    endsAt: promotion.endsAt?.toISOString(),
    locationIds: promotion.locationIds,
    targetScope: promotion.target.scope,
    benefitType: promotion.benefit.type,
    isStackable: promotion.isStackable,
  };
}

export function recordTaxClass(
  audit: AuditRecorder,
  entry: { action: AuditAction; before: TaxClass | undefined; after: TaxClass },
): Promise<void> {
  return audit.record({
    action: entry.action,
    entityType: AUDIT_ENTITY_TYPE.taxClass,
    entityId: entry.after.taxClassId,
    changes: diffAuditFields(taxClassFields(entry.before), taxClassFields(entry.after)),
  });
}

export async function recordPromotion(
  dependencies: {
    readonly audit: AuditRecorder;
    readonly events: typeof kernelEventPublisher;
  },
  entry: { action: AuditAction; before: Promotion | undefined; after: Promotion },
): Promise<void> {
  const changes: AuditChanges = diffAuditFields(
    promotionFields(entry.before),
    promotionFields(entry.after),
  );
  await dependencies.audit.record({
    action: entry.action,
    entityType: AUDIT_ENTITY_TYPE.promotion,
    entityId: entry.after.promotionId,
    changes,
  });
  await dependencies.events.publish(PRICING_EVENT_TYPE.PROMOTION_CHANGED, {
    promotionId: entry.after.promotionId,
  });
}
