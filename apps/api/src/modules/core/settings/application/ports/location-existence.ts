/** An ACTIVE location of this organization. Another organization's row, or an archived one, is absent. */
export interface LocationExistence {
  exists(locationId: string): Promise<boolean>;
}
