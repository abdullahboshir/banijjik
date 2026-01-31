import { Types } from "mongoose";
/**
 * 🗂️ Permission Group Seeder
 * Creates PermissionGroups for each resource, grouped by domain (Bounded Context).
 * Returns a map of resource names to their corresponding PermissionGroup IDs.
 */
export declare function syncPermissionGroups(): Promise<Record<string, Types.ObjectId>>;
/**
 * Helper to get PermissionGroup IDs by domain name (sidebar grouping)
 */
export declare function getGroupsByDomain(domainName: string): Promise<Types.ObjectId[]>;
/**
 * Helper to get all PermissionGroup IDs
 */
export declare function getAllGroupIds(): Promise<Types.ObjectId[]>;
//# sourceMappingURL=permission-group.seeder.d.ts.map