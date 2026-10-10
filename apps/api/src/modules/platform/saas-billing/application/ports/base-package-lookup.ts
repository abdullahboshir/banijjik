/** The id of an active base package by its key. Adapted from platform/package in index.ts. */
export interface BasePackageLookup {
  findActiveBasePackageId(packageKey: string): Promise<string | undefined>;
}
