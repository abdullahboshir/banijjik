/**
 * How many ACTIVE locations the organization of the current tenant context has. The entitlement
 * config service uses it to decide whether the "Locations" menu entry shows (10 section 6).
 */
export interface ActiveLocationCounter {
  countActive(): Promise<number>;
}
