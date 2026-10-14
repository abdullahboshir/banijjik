/**
 * Whether a location of the current organization is ACTIVE. Settings asks through this port
 * instead of reading the Location model (ADR-011a, ADR-023). An archived location is not a place
 * for a new setting.
 */
export interface LocationLookup {
  isActiveLocation(locationId: string): Promise<boolean>;
}
