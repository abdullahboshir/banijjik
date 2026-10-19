import { PERMISSION_KEY } from "@banijjik/contracts";
import type { LocationResponse } from "@banijjik/contracts";
import type {
  InventoryItemResponse,
  InventoryLevelRow,
  StockMovementResponse,
} from "@banijjik/contracts/inventory";
import type { UnitKey } from "@banijjik/contracts/catalog";
import { DetailHeader, EmptyState, PageLayout, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadCatalogLookups } from "../catalog/catalog-lookups";
import {
  ItemDetailFacts,
  ItemLevelsSection,
  ItemMovementsSection,
} from "./inventory-item-detail-sections";
import {
  itemDetailLabelsOf,
  stockLabelsOf,
  type ItemDetailLabels,
  type StockLabels,
} from "./stock-labels";
import { stockLevelsApiPath, stockMovementsApiPath } from "./stock-query";

function unitLabelOf(t: (key: string) => string, unitKey: UnitKey): string {
  return t(`catalog.unit.${unitKey}`);
}

async function levelsForItem(
  organizationId: string,
  inventoryItemId: string,
  locations: readonly LocationResponse[],
): Promise<InventoryLevelRow[]> {
  const pages = await Promise.all(
    locations.map((location) =>
      fetchBusinessResource<InventoryLevelRow[], PageMeta>(
        stockLevelsApiPath(
          organizationId,
          { locationId: location.locationId, q: undefined, lowOnly: false, page: 1 },
          location.locationId,
        ),
      ),
    ),
  );
  return pages
    .flatMap((page) => page.data)
    .filter((row) => row.inventoryItemId === inventoryItemId);
}

async function loadMovements(
  organizationId: string,
  inventoryItemId: string,
  canRead: boolean,
): Promise<StockMovementResponse[]> {
  if (!canRead) return [];
  const page = await fetchBusinessResource<StockMovementResponse[], PageMeta>(
    stockMovementsApiPath(organizationId, { inventoryItemId, limit: 50 }),
  );
  return page.data;
}

function InventoryItemDetailView(props: {
  orgSlug: string;
  item: InventoryItemResponse;
  labels: ItemDetailLabels;
  stockLabels: StockLabels;
  locale: DisplayLocale;
  levelRows: InventoryLevelRow[];
  locations: readonly LocationResponse[];
  movements: StockMovementResponse[];
  canReadMovements: boolean;
  unitLabel: (unitKey: UnitKey) => string;
  reasonLabel: (reason: StockMovementResponse["reason"]) => string;
}): ReactElement {
  return (
    <PageLayout title={props.item.name}>
      <DetailHeader
        title={props.item.name}
        backHref={`/${props.orgSlug}/catalog/stock`}
        backLabel={props.stockLabels.backToStock}
        facts={
          <ItemDetailFacts item={props.item} labels={props.labels} unitLabel={props.unitLabel} />
        }
      />
      <ItemLevelsSection
        levelRows={props.levelRows}
        locations={props.locations}
        labels={props.labels}
        stockLabels={props.stockLabels}
        locale={props.locale}
        unitLabel={props.unitLabel}
      />
      {props.canReadMovements ? (
        <ItemMovementsSection
          movements={props.movements}
          locations={props.locations}
          labels={props.labels}
          locale={props.locale}
          reasonLabel={props.reasonLabel}
        />
      ) : null}
    </PageLayout>
  );
}

/** `/{orgSlug}/catalog/stock/{inventoryItemId}`: item facts, levels and movements. */
export async function InventoryItemDetailPage({
  orgSlug,
  inventoryItemId,
}: {
  orgSlug: string;
  inventoryItemId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  const { permissions } = access.config;
  const canReadStock = holdsPermission(permissions, PERMISSION_KEY.INVENTORY_STOCK_READ);
  if (!canReadStock) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const canReadMovements = holdsPermission(permissions, PERMISSION_KEY.INVENTORY_MOVEMENT_READ);
  const { organizationId } = access.organization;
  const [item, lookups] = await Promise.all([
    fetchBusinessResource<InventoryItemResponse>(
      `/orgs/${organizationId}/inventory-items/${inventoryItemId}`,
    ),
    loadCatalogLookups(access),
  ]);
  const [levelRows, movements] = await Promise.all([
    levelsForItem(organizationId, inventoryItemId, lookups.locations),
    loadMovements(organizationId, inventoryItemId, canReadMovements),
  ]);
  const labels = itemDetailLabelsOf(t);
  const stockLabels = stockLabelsOf(t);
  const unitLabel = (unitKey: UnitKey) => unitLabelOf(t, unitKey);

  return (
    <InventoryItemDetailView
      orgSlug={orgSlug}
      item={item.data}
      labels={labels}
      stockLabels={stockLabels}
      locale={locale}
      levelRows={levelRows}
      locations={lookups.locations}
      movements={movements}
      canReadMovements={canReadMovements}
      unitLabel={unitLabel}
      reasonLabel={(reason) => t(`stock.movement.reason.${reason}`)}
    />
  );
}
