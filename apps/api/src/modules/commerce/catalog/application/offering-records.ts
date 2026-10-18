import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type AuditAction,
  type AuditChanges,
} from "@banijjik/contracts";
import { CATALOG_EVENT_TYPE, type CatalogEventType } from "@banijjik/contracts/catalog";
import { diffAuditFields, type AuditFields } from "../../../../kernel/audit/index.js";
import type { Offering } from "../domain/offering.entity.js";
import { hasPriceChange, type Variant } from "../domain/variant.js";
import type { CatalogDependencies } from "./catalog-dependencies.js";

/** One stream per offering: its created, updated, published, archived and price events arrive in order. */
export function orderingKeyOf(offeringId: string): string {
  return `offering:${offeringId}`;
}

type RecordingDependencies = Pick<CatalogDependencies, "audit" | "events">;

function variantFields(variants: readonly Variant[]): Record<string, string | number | undefined> {
  const fields: Record<string, string | number | undefined> = {};
  for (const variant of variants) {
    const prefix = `variants.${variant.variantId}`;
    fields[`${prefix}.name`] = variant.name;
    fields[`${prefix}.price`] = variant.price.amount;
    fields[`${prefix}.compareAtPrice`] = variant.compareAtPrice?.amount;
    fields[`${prefix}.sku`] = variant.sku;
    fields[`${prefix}.barcode`] = variant.barcode;
    fields[`${prefix}.unitKey`] = variant.unitKey;
    fields[`${prefix}.status`] = variant.status;
  }
  return fields;
}

/** The fields an audit entry shows. Prices are business data, not personal data, so they appear with their values. */
function offeringFields(offering: Offering | undefined): AuditFields {
  if (offering === undefined) return {};
  return {
    kind: offering.kind,
    name: offering.name,
    slug: offering.slug,
    status: offering.status,
    description: offering.description,
    categoryIds: [...offering.categoryIds],
    modifierGroupIds: [...offering.modifierGroupIds],
    imageFileIds: [...offering.imageFileIds],
    taxClassKey: offering.taxClassKey,
    synonyms: [...offering.synonyms],
    kindDetails: JSON.stringify(offering.kindDetails),
    ...variantFields(offering.variants),
  };
}

export function offeringAuditChanges(before: Offering | undefined, after: Offering): AuditChanges {
  return diffAuditFields(offeringFields(before), offeringFields(after));
}

async function record(
  dependencies: RecordingDependencies,
  entry: {
    readonly action: AuditAction;
    readonly eventType: CatalogEventType;
    readonly offering: Offering;
    readonly changes: AuditChanges;
  },
): Promise<void> {
  const { offering } = entry;
  await dependencies.audit.record({
    action: entry.action,
    entityType: AUDIT_ENTITY_TYPE.offering,
    entityId: offering.offeringId,
    changes: entry.changes,
  });
  // The events of one offering stay in order for ORDERED handlers (card 3.8a, ADR-115).
  await dependencies.events.publish(
    entry.eventType,
    { offeringId: offering.offeringId },
    { orderingKey: orderingKeyOf(offering.offeringId) },
  );
}

/** One audit entry and one event for a new offering. Call inside the unit of work. */
export function recordOfferingCreated(
  dependencies: RecordingDependencies,
  offering: Offering,
  customFieldChanges: AuditChanges = {},
): Promise<void> {
  return record(dependencies, {
    action: AUDIT_ACTION.OFFERING_CREATED,
    eventType: CATALOG_EVENT_TYPE.OFFERING_CREATED,
    offering,
    changes: { ...offeringAuditChanges(undefined, offering), ...customFieldChanges },
  });
}

/** One audit entry and one event for an edit, and a `priceChanged` event when a variant price moved. */
export async function recordOfferingUpdated(
  dependencies: RecordingDependencies,
  change: {
    readonly before: Offering;
    readonly after: Offering;
    readonly customFieldChanges?: AuditChanges;
  },
): Promise<void> {
  await record(dependencies, {
    action: AUDIT_ACTION.OFFERING_UPDATED,
    eventType: CATALOG_EVENT_TYPE.OFFERING_UPDATED,
    offering: change.after,
    changes: {
      ...offeringAuditChanges(change.before, change.after),
      ...change.customFieldChanges,
    },
  });
  if (hasPriceChange(change.before.variants, change.after.variants)) {
    await dependencies.events.publish(
      CATALOG_EVENT_TYPE.OFFERING_PRICE_CHANGED,
      { offeringId: change.after.offeringId },
      { orderingKey: orderingKeyOf(change.after.offeringId) },
    );
  }
}

/** Publish and archive record the status change. */
export function recordOfferingTransition(
  dependencies: RecordingDependencies,
  change: { readonly before: Offering; readonly after: Offering; readonly isArchive: boolean },
): Promise<void> {
  return record(dependencies, {
    action: change.isArchive ? AUDIT_ACTION.OFFERING_ARCHIVED : AUDIT_ACTION.OFFERING_PUBLISHED,
    eventType: change.isArchive
      ? CATALOG_EVENT_TYPE.OFFERING_ARCHIVED
      : CATALOG_EVENT_TYPE.OFFERING_PUBLISHED,
    offering: change.after,
    changes: offeringAuditChanges(change.before, change.after),
  });
}
