import { SYSTEM_REASON } from "@banijjik/contracts";
import { runAsSystem } from "../kernel/context/index.js";
import { createMissingIndexes, type CollectionIndexSync } from "../kernel/db/index.js";

export interface IndexSyncOutcome {
  readonly collections: readonly CollectionIndexSync[];
  readonly createdCount: number;
  readonly conflictCount: number;
}

/**
 * Creates the declared indexes that are missing and reports the ones that conflict. Safe to
 * repeat: a second run finds everything in place. It never drops an index (ADR-094).
 */
export async function syncIndexes(): Promise<IndexSyncOutcome> {
  const collections = await runAsSystem(SYSTEM_REASON.MIGRATION, () => createMissingIndexes());
  return {
    collections,
    createdCount: collections.reduce((total, entry) => total + entry.created, 0),
    conflictCount: collections.reduce((total, entry) => total + entry.conflicting.length, 0),
  };
}
