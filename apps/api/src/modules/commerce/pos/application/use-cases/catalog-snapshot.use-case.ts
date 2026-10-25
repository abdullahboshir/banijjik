import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import type { PosCatalogRow, PosCatalogSnapshotResponse } from "@banijjik/contracts/pos";
import type { OrganizationId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { PosSnapshotItem, PosSnapshotKey } from "../../../catalog/index.js";
import type { PosCatalogReader } from "../ports/pos-ports.js";
import type { PosDeviceContext } from "./session.use-cases.js";

const CURSOR_SEPARATOR = "|";

/** An opaque keyset cursor: the sort key of the last offering of the page. */
export function encodeCursor(key: PosSnapshotKey): string {
  return Buffer.from(`${key.updatedAt.toISOString()}${CURSOR_SEPARATOR}${key.offeringId}`).toString(
    "base64url",
  );
}

function invalidCursor(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "validation.invalid_format",
  });
}

export function decodeCursor(cursor: string): PosSnapshotKey {
  const [iso, offeringId] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split(CURSOR_SEPARATOR);
  const updatedAt = new Date(iso ?? "");
  if (offeringId === undefined || offeringId === "" || Number.isNaN(updatedAt.getTime())) {
    throw invalidCursor();
  }
  return { updatedAt, offeringId };
}

function toRow(item: PosSnapshotItem): PosCatalogRow {
  return {
    offeringId: item.offeringId,
    variantId: item.variantId,
    kind: item.kind,
    offeringName: item.offeringName,
    variantName: item.variantName,
    price: {
      amount: item.priceMinor,
      currency: item.currency as PosCatalogRow["price"]["currency"],
    },
    unitKey: item.unitKey,
    precision: item.precision,
    sku: item.sku,
    barcode: item.barcode,
    updatedAt: item.updatedAt.toISOString(),
  };
}

/** `GET /pos/catalog-snapshot`: the compact, pageable catalog a till keeps locally (plan decision 8). */
export class GetPosCatalogSnapshotUseCase {
  constructor(
    private readonly dependencies: { readonly catalog: PosCatalogReader; readonly clock: Clock },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly device: PosDeviceContext;
    readonly since: string | undefined;
    readonly cursor: string | undefined;
    readonly limit: number;
  }): Promise<PosCatalogSnapshotResponse> {
    const { catalog, clock } = this.dependencies;
    const serverTime = clock.now();
    const page = await catalog.readPage({
      organizationId: input.organizationId,
      locationId: input.device.locationId,
      since: input.since === undefined ? undefined : new Date(input.since),
      after: input.cursor === undefined ? undefined : decodeCursor(input.cursor),
      limit: input.limit,
    });
    return {
      items: page.items.map(toRow),
      removed: page.removed,
      nextCursor: page.next === null ? null : encodeCursor(page.next),
      serverTime: serverTime.toISOString(),
    };
  }
}
