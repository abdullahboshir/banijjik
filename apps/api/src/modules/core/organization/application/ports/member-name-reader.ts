/**
 * Display names of members of the active organization, for modules that show or check who a record
 * is about (card 3.11). A member that does not exist is absent from the map.
 */
export interface MemberNameReader {
  readNames(memberIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
