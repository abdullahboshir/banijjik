import { PERMISSION_KEY } from "@banijjik/contracts";
import type { InventoryLevelRow } from "@banijjik/contracts/inventory";
import type { UnitKey } from "@banijjik/contracts/catalog";
import { UNIT_KEY } from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, formatMoney } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadCatalogLookups } from "../catalog/catalog-lookups";
import { StockListPageView } from "./stock-list-page-view";
import { type StockListLabels, type StockRowView } from "./stock-list";
import { stockLabelsOf } from "./stock-labels";
import { parseStockQuery, stockLevelsApiPath, type StockQuery } from "./stock-query";
import { quantityInUnitWords } from "./stock-unit-text";

function unitLabelOf(t: Translator["t"], unitKey: UnitKey): string {
  return t(`catalog.unit.${unitKey}`);
}

function unitLabelsOf(t: Translator["t"]): Record<UnitKey, string> {
  const entries = Object.values(UNIT_KEY).map((unitKey) => [unitKey, unitLabelOf(t, unitKey)]);
  return Object.fromEntries(entries) as Record<UnitKey, string>;
}

function toRow(
  row: InventoryLevelRow,
  context: { translator: Translator; lowLabel: string },
): StockRowView {
  const { t, locale } = context.translator;
  const unitLabel = (unitKey: UnitKey) => unitLabelOf(t, unitKey);
  return {
    inventoryItemId: row.inventoryItemId,
    name: row.itemName,
    onHandText: quantityInUnitWords(row.onHand, row.baseUnitKey, unitLabel),
    availableText: quantityInUnitWords(row.available, row.baseUnitKey, unitLabel),
    valueText: formatMoney(row.inventoryValue, { locale }),
    lowStock: row.lowStock,
    lowLabel: context.lowLabel,
  };
}

function listLabelsOf(t: Translator["t"]): StockListLabels {
  return {
    name: t("stock.column.name"),
    onHand: t("stock.column.onHand"),
    available: t("stock.column.available"),
    value: t("stock.column.value"),
  };
}

function resolvedLocationId(
  query: StockQuery,
  locations: { locationId: string }[],
): string | undefined {
  if (query.locationId !== undefined) return query.locationId;
  return locations[0]?.locationId;
}

async function loadLevels(
  organizationId: string,
  query: StockQuery,
  locationId: string | undefined,
): Promise<{ levels: InventoryLevelRow[]; hasNext: boolean }> {
  if (locationId === undefined) return { levels: [], hasNext: false };
  const result = await fetchBusinessResource<InventoryLevelRow[], PageMeta>(
    stockLevelsApiPath(organizationId, query, locationId),
  );
  return { levels: result.data, hasNext: result.meta?.hasNext ?? false };
}

function stockPermissions(
  access: OrgAccess,
  permissions: OrgAccess["config"]["permissions"],
): {
  canReceive: boolean;
  canAdjust: boolean;
  canCreateItem: boolean;
} {
  const canReceive =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.INVENTORY_ADJUSTMENT_CREATE);
  return {
    canReceive,
    canAdjust: canReceive,
    canCreateItem:
      access.canWrite && holdsPermission(permissions, PERMISSION_KEY.INVENTORY_ITEM_UPDATE),
  };
}

/** `/{orgSlug}/catalog/stock`: on-hand and value at each branch. */
export async function StockListPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.INVENTORY_STOCK_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseStockQuery(searchParams);
  const lookups = await loadCatalogLookups(access);
  const locationId = resolvedLocationId(query, lookups.locations);
  const { levels, hasNext } = await loadLevels(
    access.organization.organizationId,
    query,
    locationId,
  );
  const labels = stockLabelsOf(t);
  const perms = stockPermissions(access, permissions);

  return (
    <StockListPageView
      orgSlug={orgSlug}
      access={access}
      lookups={lookups}
      query={query}
      locationId={locationId}
      labels={labels}
      listLabels={listLabelsOf(t)}
      unitLabels={unitLabelsOf(t)}
      rows={levels.map((row) => toRow(row, { translator, lowLabel: labels.lowBadge }))}
      hasNext={hasNext}
      canReceive={perms.canReceive}
      canAdjust={perms.canAdjust}
      canCreateItem={perms.canCreateItem}
      t={t}
    />
  );
}
