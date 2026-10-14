/** A location of this organization. The tenant plugin hides every other organization's rows. */
export interface LocationExistence {
  exists(locationId: string): Promise<boolean>;
}
