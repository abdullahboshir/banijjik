/** One group of the approved-listing aggregation: the option value (null when the listing has none) and its count. */
export interface ApprovedCountGroup {
  readonly option: string | null;
  readonly count: number;
}

/** What the home statistics row holds after one recompute. */
export interface ListingStatsSnapshot {
  readonly approvedCount: number;
  readonly fieldKey: string | null;
  readonly countsByOption: Readonly<Record<string, number>>;
}

/**
 * Turns the aggregation groups into the snapshot. The total counts every approved listing, also
 * those without a value for the statistics field. Only options with a value appear in the map.
 */
export function summarizeApprovedCounts(
  fieldKey: string | null,
  groups: readonly ApprovedCountGroup[],
): ListingStatsSnapshot {
  const countsByOption: Record<string, number> = {};
  let approvedCount = 0;
  for (const group of groups) {
    approvedCount += group.count;
    if (group.option !== null) countsByOption[group.option] = group.count;
  }
  return { approvedCount, fieldKey, countsByOption };
}

/** Equal snapshots need no write, so a rerun of the handler leaves the row (and its version) untouched. */
export function isSameListingStats(
  left: ListingStatsSnapshot,
  right: ListingStatsSnapshot,
): boolean {
  if (left.approvedCount !== right.approvedCount || left.fieldKey !== right.fieldKey) return false;
  const leftOptions = Object.keys(left.countsByOption).sort();
  const rightOptions = Object.keys(right.countsByOption).sort();
  if (leftOptions.length !== rightOptions.length) return false;
  return leftOptions.every(
    (option, index) =>
      option === rightOptions[index] &&
      left.countsByOption[option] === right.countsByOption[option],
  );
}
