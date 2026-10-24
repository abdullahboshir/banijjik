/**
 * Members who may perform a sale at a location (plan 3.11 Refresh C): ACTIVE, and assigned at that
 * location or at ALL locations. Only names leave this port, never contact data or roles.
 */
export interface MemberPerformerReader {
  /** The ids of the given members that may perform at the location; any other id is absent. */
  filterAssignable(locationId: string, memberIds: readonly string[]): Promise<ReadonlySet<string>>;
  /** Up to `limit` such members, by display name. */
  listAt(
    locationId: string,
    limit: number,
  ): Promise<readonly { readonly memberId: string; readonly name: string }[]>;
}
