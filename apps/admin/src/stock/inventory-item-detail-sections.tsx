import type { LocationResponse } from "@banijjik/contracts";
import type {
  InventoryItemResponse,
  InventoryLevelRow,
  StockMovementResponse,
} from "@banijjik/contracts/inventory";
import type { UnitKey } from "@banijjik/contracts/catalog";
import { PageSection, formatMoney, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ItemDetailLabels, StockLabels } from "./stock-labels";
import { quantityInUnitWords } from "./stock-unit-text";

function locationNameOf(locations: readonly LocationResponse[], locationId: string): string {
  return locations.find((location) => location.locationId === locationId)?.name ?? locationId;
}

export function ItemDetailFacts(props: {
  item: InventoryItemResponse;
  labels: ItemDetailLabels;
  unitLabel: (unitKey: UnitKey) => string;
}): ReactElement {
  const { item, labels, unitLabel } = props;
  return (
    <dl className="grid gap-2 md:grid-cols-2">
      <div>
        <dt className="text-caption text-secondary">{labels.unit}</dt>
        <dd>{unitLabel(item.baseUnitKey)}</dd>
      </div>
      {item.sku ? (
        <div>
          <dt className="text-caption text-secondary">{labels.sku}</dt>
          <dd>{item.sku}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-caption text-secondary">{labels.status}</dt>
        <dd>{item.status === "ACTIVE" ? labels.statusActive : labels.statusArchived}</dd>
      </div>
      {item.lowStockThreshold !== undefined ? (
        <div>
          <dt className="text-caption text-secondary">{labels.threshold}</dt>
          <dd>{quantityInUnitWords(item.lowStockThreshold, item.baseUnitKey, unitLabel)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function ItemLevelsSection(props: {
  levelRows: InventoryLevelRow[];
  locations: readonly LocationResponse[];
  labels: ItemDetailLabels;
  stockLabels: StockLabels;
  locale: DisplayLocale;
  unitLabel: (unitKey: UnitKey) => string;
}): ReactElement {
  return (
    <PageSection title={props.labels.levelsTitle}>
      {props.levelRows.length === 0 ? (
        <p className="text-body text-secondary">{props.stockLabels.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {props.levelRows.map((row) => (
            <li
              key={row.locationId}
              className="flex flex-col gap-1 rounded-md border border-default p-3 md:flex-row md:items-center md:justify-between"
            >
              <span className="font-semibold text-primary">
                {locationNameOf(props.locations, row.locationId)}
              </span>
              <span className="text-small text-secondary">
                {props.labels.levelsOnHand}:{" "}
                {quantityInUnitWords(row.onHand, row.baseUnitKey, props.unitLabel)} ·{" "}
                {props.labels.levelsAvailable}:{" "}
                {quantityInUnitWords(row.available, row.baseUnitKey, props.unitLabel)} ·{" "}
                {formatMoney(
                  {
                    amount: row.onHand * row.averageUnitCost.amount,
                    currency: row.averageUnitCost.currency,
                  },
                  { locale: props.locale },
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  );
}

export function ItemMovementsSection(props: {
  movements: StockMovementResponse[];
  locations: readonly LocationResponse[];
  labels: ItemDetailLabels;
  locale: DisplayLocale;
  reasonLabel: (reason: StockMovementResponse["reason"]) => string;
}): ReactElement {
  return (
    <PageSection title={props.labels.movementsTitle}>
      {props.movements.length === 0 ? (
        <p className="text-body text-secondary">{props.labels.noMovements}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.movements.map((movement) => (
            <li
              key={movement.stockMovementId}
              className="flex flex-col gap-1 rounded-md border border-default p-3 text-small"
            >
              <span className="text-primary">
                {props.labels.movementWhen}:{" "}
                {new Date(movement.occurredAt).toLocaleString(props.locale)}
              </span>
              <span className="text-secondary">
                {props.labels.movementLocation}:{" "}
                {locationNameOf(props.locations, movement.locationId)}
              </span>
              <span className="text-secondary">
                {props.labels.movementDelta}: {movement.quantityDelta > 0 ? "+" : ""}
                {movement.quantityDelta}
              </span>
              <span className="text-secondary">
                {props.labels.movementReason}: {props.reasonLabel(movement.reason)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  );
}
