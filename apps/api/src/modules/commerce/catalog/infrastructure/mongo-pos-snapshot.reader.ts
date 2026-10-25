import { OFFERING_KIND } from "@banijjik/contracts";
import { OFFERING_STATUS, UNITS, VARIANT_STATUS } from "@banijjik/contracts/catalog";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { OFFERING_MODEL_NAME, type OfferingDocument } from "./offering.schema.js";
import { OFFERING_LOCATION_MODEL_NAME, type OfferingLocationDocument } from "./record.schemas.js";

/** One sellable variant as a till caches it (plan 3.9 decision 8). */
export interface PosSnapshotItem {
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: string;
  readonly offeringName: string;
  readonly variantName: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly unitKey: string;
  readonly precision: number;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly updatedAt: Date;
}

export interface PosSnapshotKey {
  readonly updatedAt: Date;
  readonly offeringId: string;
}

export interface PosSnapshotQuery {
  readonly organizationId: string;
  readonly locationId: string;
  readonly since?: Date | undefined;
  readonly after?: PosSnapshotKey | undefined;
  readonly limit: number;
}

export interface PosSnapshotPage {
  readonly items: readonly PosSnapshotItem[];
  /** Only with `since`: variants that changed but cannot be sold here any more. */
  readonly removed: readonly { readonly offeringId: string; readonly variantId: string }[];
  readonly next: PosSnapshotKey | null;
}

export interface PosSnapshotReader {
  readPage(query: PosSnapshotQuery): Promise<PosSnapshotPage>;
}

/** The ids of offerings whose availability or price at the location changed since `since`. */
const MAX_CHANGED_LOCATION_ROWS = 5_000;

const SNAPSHOT_SORT = { updatedAt: 1, offeringId: 1 } as const;

type OfferingRow = Omit<OfferingDocument, "organizationId">;

function offeringModel() {
  return models({}).get<OfferingDocument>(OFFERING_MODEL_NAME);
}

function locationModel() {
  return models({}).get<OfferingLocationDocument>(OFFERING_LOCATION_MODEL_NAME);
}

async function offeringsChangedAtLocation(query: PosSnapshotQuery): Promise<readonly string[]> {
  if (query.since === undefined) return [];
  const rows = await locationModel()
    .find(
      {
        organizationId: query.organizationId,
        locationId: query.locationId,
        updatedAt: { $gte: query.since },
      },
      { _id: 0, offeringId: 1 },
      { ...sessionOption(getActiveSession()), limit: MAX_CHANGED_LOCATION_ROWS },
    )
    .lean<{ offeringId: string }[]>();
  return [...new Set(rows.map((row) => row.offeringId))];
}

function filterOf(query: PosSnapshotQuery, changedIds: readonly string[]): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    organizationId: query.organizationId,
    kind: OFFERING_KIND.PRODUCT,
  };
  if (query.since === undefined) {
    filter["status"] = OFFERING_STATUS.ACTIVE;
  } else {
    filter["$or"] = [
      { updatedAt: { $gte: query.since } },
      { offeringId: { $in: [...changedIds] } },
    ];
  }
  if (query.after !== undefined) {
    const { updatedAt, offeringId } = query.after;
    filter["$and"] = [
      { $or: [{ updatedAt: { $gt: updatedAt } }, { updatedAt, offeringId: { $gt: offeringId } }] },
    ];
  }
  return filter;
}

function locationRowsByOffering(
  rows: readonly OfferingLocationDocument[],
): ReadonlyMap<string, readonly OfferingLocationDocument[]> {
  const byOffering = new Map<string, OfferingLocationDocument[]>();
  for (const row of rows) {
    const list = byOffering.get(row.offeringId) ?? [];
    list.push(row);
    byOffering.set(row.offeringId, list);
  }
  return byOffering;
}

interface VariantFacts {
  readonly offering: OfferingRow;
  readonly variant: OfferingRow["variants"][number];
  readonly rows: readonly OfferingLocationDocument[];
}

/** The same rule as the quote: an offering-wide or variant row can switch a variant off here. */
function isSellableHere(facts: VariantFacts): boolean {
  const { offering, variant, rows } = facts;
  if (offering.status !== OFFERING_STATUS.ACTIVE) return false;
  if (variant.status !== VARIANT_STATUS.ACTIVE) return false;
  const offeringRow = rows.find((row) => row.variantId === null);
  const variantRow = rows.find((row) => row.variantId === variant.variantId);
  return offeringRow?.isAvailable !== false && variantRow?.isAvailable !== false;
}

function itemOf(facts: VariantFacts): PosSnapshotItem {
  const { offering, variant, rows } = facts;
  const override = rows.find((row) => row.variantId === variant.variantId)?.priceOverride;
  return {
    offeringId: offering.offeringId,
    variantId: variant.variantId,
    kind: offering.kind,
    offeringName: offering.name,
    variantName: variant.name,
    priceMinor: (override ?? variant.price).amount,
    currency: variant.price.currency,
    unitKey: variant.unitKey,
    precision: UNITS[variant.unitKey].precision,
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
    updatedAt: offering.updatedAt,
  };
}

export function buildPosSnapshotReader(): PosSnapshotReader {
  return {
    async readPage(query) {
      const changedIds = await offeringsChangedAtLocation(query);
      const found = await offeringModel()
        .find(filterOf(query, changedIds), { _id: 0 }, sessionOption(getActiveSession()))
        .sort(SNAPSHOT_SORT)
        .limit(query.limit + 1)
        .lean<OfferingRow[]>();
      const page = found.slice(0, query.limit);
      const locationRows = await locationModel()
        .find(
          {
            organizationId: query.organizationId,
            locationId: query.locationId,
            offeringId: { $in: page.map((offering) => offering.offeringId) },
          },
          { _id: 0 },
          sessionOption(getActiveSession()),
        )
        .lean<OfferingLocationDocument[]>();
      const rowsByOffering = locationRowsByOffering(locationRows);
      const items: PosSnapshotItem[] = [];
      const removed: { offeringId: string; variantId: string }[] = [];
      for (const offering of page) {
        for (const variant of offering.variants) {
          const facts = { offering, variant, rows: rowsByOffering.get(offering.offeringId) ?? [] };
          if (isSellableHere(facts)) items.push(itemOf(facts));
          else if (query.since !== undefined) {
            removed.push({ offeringId: offering.offeringId, variantId: variant.variantId });
          }
        }
      }
      const last = page[page.length - 1];
      const hasNext = found.length > query.limit && last !== undefined;
      return {
        items,
        removed,
        next: hasNext ? { updatedAt: last.updatedAt, offeringId: last.offeringId } : null,
      };
    },
  };
}
