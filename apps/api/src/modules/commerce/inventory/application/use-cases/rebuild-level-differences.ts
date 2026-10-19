import type { InventoryLevelRecord } from "../ports/stock-records.js";
import type { ProjectedLevel } from "../level-projection.js";

export type LevelDifference = {
  readonly key: string;
  readonly field: string;
  readonly expected: number;
  readonly actual: number;
};

function fieldDifferences(
  key: string,
  expected: ProjectedLevel,
  actual: InventoryLevelRecord | undefined,
): LevelDifference[] {
  const compare = [
    ["onHand", expected.onHand, actual?.onHand ?? 0],
    ["damaged", expected.damaged, actual?.damaged ?? 0],
    ["averageUnitCostMicros", expected.averageUnitCostMicros, actual?.averageUnitCostMicros ?? 0],
  ] as const;
  const differences: LevelDifference[] = [];
  for (const [field, exp, act] of compare) {
    if (exp !== act) differences.push({ key, field, expected: exp, actual: act });
  }
  return differences;
}

export function compareProjectedToStored(
  projected: Map<string, ProjectedLevel>,
  stored: readonly InventoryLevelRecord[],
): LevelDifference[] {
  const differences: LevelDifference[] = [];
  const storedMap = new Map(
    stored.map((level) => [`${level.locationId}:${level.inventoryItemId}`, level]),
  );
  for (const [key, expected] of projected) {
    differences.push(...fieldDifferences(key, expected, storedMap.get(key)));
    storedMap.delete(key);
  }
  for (const [key, actual] of storedMap) {
    if (actual.onHand !== 0 || actual.damaged !== 0) {
      differences.push({ key, field: "onHand", expected: 0, actual: actual.onHand });
    }
  }
  return differences;
}
