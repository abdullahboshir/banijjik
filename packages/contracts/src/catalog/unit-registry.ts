import { defineEnum } from "../define-enum.js";

/** What a unit measures. Units of one dimension convert to each other (card 3.3 uses it for stock). */
export const UNIT_DIMENSION = defineEnum(["COUNT", "WEIGHT", "VOLUME", "LENGTH", "TIME"]);
export type UnitDimension = (typeof UNIT_DIMENSION)[keyof typeof UNIT_DIMENSION];

export const UNIT_KEY = defineEnum([
  "PIECE",
  "SET",
  "PAIR",
  "BOX",
  "GRAM",
  "KG",
  "ML",
  "LITRE",
  "CM",
  "METRE",
  "MINUTE",
  "HOUR",
  "DAY",
  "SESSION",
]);
export type UnitKey = (typeof UNIT_KEY)[keyof typeof UNIT_KEY];

export interface UnitDefinition {
  readonly unitKey: UnitKey;
  readonly dimension: UnitDimension;
  /** Decimal places of a quantity in this unit. A quantity is an integer of that precision (ADR-047): 1.25 kg is 1250. */
  readonly precision: number;
  /** Integer multiple of the dimension's base unit (gram, millilitre, centimetre, minute). */
  readonly factorToBase: number;
}

function unit(
  unitKey: UnitKey,
  dimension: UnitDimension,
  size: { readonly precision: number; readonly factorToBase: number },
): UnitDefinition {
  return { unitKey, dimension, ...size };
}

function counted(unitKey: UnitKey, dimension: UnitDimension): UnitDefinition {
  return unit(unitKey, dimension, { precision: 0, factorToBase: 1 });
}

const MILLIS_PER_LITRE = 1000;
const GRAMS_PER_KG = 1000;
const CENTIMETRES_PER_METRE = 100;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * The unit registry (ADR-116). "Dozen" is a pack, not a unit (ADR-098). SESSION counts sessions
 * and is never converted to minutes: its factor is 1 only so the registry stays uniform.
 */
export const UNITS: Readonly<Record<UnitKey, UnitDefinition>> = Object.freeze({
  PIECE: counted("PIECE", "COUNT"),
  SET: counted("SET", "COUNT"),
  PAIR: counted("PAIR", "COUNT"),
  BOX: counted("BOX", "COUNT"),
  GRAM: counted("GRAM", "WEIGHT"),
  KG: unit("KG", "WEIGHT", { precision: 3, factorToBase: GRAMS_PER_KG }),
  ML: counted("ML", "VOLUME"),
  LITRE: unit("LITRE", "VOLUME", { precision: 3, factorToBase: MILLIS_PER_LITRE }),
  CM: counted("CM", "LENGTH"),
  METRE: unit("METRE", "LENGTH", { precision: 2, factorToBase: CENTIMETRES_PER_METRE }),
  MINUTE: counted("MINUTE", "TIME"),
  HOUR: unit("HOUR", "TIME", { precision: 0, factorToBase: MINUTES_PER_HOUR }),
  DAY: unit("DAY", "TIME", { precision: 0, factorToBase: MINUTES_PER_DAY }),
  SESSION: counted("SESSION", "TIME"),
});

export function isUnitKey(value: string): value is UnitKey {
  return Object.hasOwn(UNITS, value);
}
