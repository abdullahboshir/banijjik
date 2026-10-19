import type { UnitKey } from "@banijjik/contracts/catalog";
import { UNIT_KEY } from "@banijjik/contracts/catalog";

/** Turns a base-unit quantity into words the screen already uses for catalog units. */
export function quantityInUnitWords(
  quantity: number,
  baseUnitKey: UnitKey,
  unitLabel: (unitKey: UnitKey) => string,
): string {
  if (baseUnitKey === UNIT_KEY.KG && quantity >= 1000 && quantity % 1000 === 0) {
    const kilos = quantity / 1000;
    return `${kilos} ${unitLabel(UNIT_KEY.KG)} (${quantity} ${unitLabel(UNIT_KEY.GRAM)})`;
  }
  if (baseUnitKey === UNIT_KEY.LITRE && quantity >= 1000 && quantity % 1000 === 0) {
    const litres = quantity / 1000;
    return `${litres} ${unitLabel(UNIT_KEY.LITRE)} (${quantity} ${unitLabel(UNIT_KEY.ML)})`;
  }
  if (baseUnitKey === UNIT_KEY.METRE && quantity >= 100 && quantity % 100 === 0) {
    const metres = quantity / 100;
    return `${metres} ${unitLabel(UNIT_KEY.METRE)} (${quantity} ${unitLabel(UNIT_KEY.CM)})`;
  }
  return `${quantity} ${unitLabel(baseUnitKey)}`;
}
