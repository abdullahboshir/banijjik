/**
 * 🗂️ Permission Group Seeder
 * Creates PermissionGroups for each resource, grouped by domain (Bounded Context).
 * Returns a map of resource names to their corresponding PermissionGroup IDs.
 */
export declare function syncPermissionGroups(): Promise<Record<string, string>>;
/**
 * Helper to get PermissionGroup IDs by domain name (sidebar grouping)
 */
export declare function getGroupsByDomain(domainName: string): Promise<string[]>;
/**
 * Helper to get all PermissionGroup IDs
 */
export declare function getAllGroupIds(): Promise<string[]>;
//# sourceMappingURL=permission-group.seeder.d.ts.map