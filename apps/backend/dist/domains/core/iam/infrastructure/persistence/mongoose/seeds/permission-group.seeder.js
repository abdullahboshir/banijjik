import { PermissionGroupModel } from "../models/permission-group.model";
import { PermissionModel } from "../models/permission.model";
import { PERMISSION_EFFECT, getDomainByResource } from "@banijjik/contracts";
/**
 * 🗂️ Permission Group Seeder
 * Creates PermissionGroups for each resource, grouped by domain (Bounded Context).
 * Returns a map of resource names to their corresponding PermissionGroup IDs.
 */
export async function syncPermissionGroups() {
    console.log("📦 Step 2: Syncing Permission Groups...");
    const resourceGroupsMap = {};
    const activeGroupIds = [];
    // 1. Get all available permissions
    const allPermissions = await PermissionModel.find({});
    console.log(`   [DEBUG] Found ${allPermissions.length} permissions in DB.`);
    // 2. Group permissions by resource (using permissionId strings)
    const permissionsByResource = {};
    allPermissions.forEach((p) => {
        const resourceName = p.resource;
        if (!resourceName)
            return;
        if (!permissionsByResource[resourceName]) {
            permissionsByResource[resourceName] = [];
        }
        permissionsByResource[resourceName].push(p.permissionId);
    });
    const allPermissionIds = allPermissions.map((p) => p.permissionId);
    // 3. Create or Update Permission Groups for each resource
    for (const [resource, permIds] of Object.entries(permissionsByResource)) {
        const domain = getDomainByResource(resource);
        const name = `${domain}:${resource}`;
        try {
            const permissionGroupId = name; // Semantic ID: iam:AUTH, iam:ROLE, etc.
            const group = await PermissionGroupModel.findOneAndUpdate({ permissionGroupId }, {
                $set: {
                    permissionGroupId,
                    name,
                    domain,
                    description: `Manage ${resource.toLowerCase().replace("_", " ")}`,
                    permissions: permIds,
                    resolver: {
                        strategy: "first-match",
                        priority: 5,
                        inheritFrom: [],
                        override: false,
                        fallback: PERMISSION_EFFECT.DENY,
                    },
                    isActive: true,
                },
            }, { upsert: true, new: true });
            if (group) {
                resourceGroupsMap[resource] = group.permissionGroupId;
                activeGroupIds.push(group.permissionGroupId);
            }
        }
        catch (e) {
            console.error(`   ⚠️ Group creation failed for ${name}:`, e.message);
        }
    }
    // 4. Create Full Access Group (for SUPER_ADMIN)
    try {
        const fullAccessPermGroupId = "system:full_access";
        const fullAccessGroup = await PermissionGroupModel.findOneAndUpdate({ permissionGroupId: fullAccessPermGroupId }, {
            $set: {
                permissionGroupId: fullAccessPermGroupId,
                name: "system:full_access",
                domain: "system",
                description: "All permissions (Full System Access)",
                permissions: allPermissionIds,
                resolver: {
                    strategy: "cumulative",
                    priority: 10,
                    inheritFrom: [],
                    override: true,
                    fallback: PERMISSION_EFFECT.DENY,
                },
                isActive: true,
            },
        }, { upsert: true, new: true });
        if (fullAccessGroup) {
            resourceGroupsMap["FULL_ACCESS"] = fullAccessGroup.permissionGroupId;
            activeGroupIds.push(fullAccessGroup.permissionGroupId);
        }
    }
    catch (e) {
        console.error("   ❌ Failed to sync full access group:", e.message);
    }
    console.log(`   ✅ Permission Groups synced: ${Object.keys(resourceGroupsMap).length} groups.`);
    // Cleanup: Remove stale groups (e.g. old dot notation IDs)
    const deleteResult = await PermissionGroupModel.deleteMany({
        permissionGroupId: { $nin: activeGroupIds },
    });
    if (deleteResult.deletedCount > 0) {
        console.log(`   🗑️  Removed ${deleteResult.deletedCount} stale permission groups.`);
    }
    return resourceGroupsMap;
}
/**
 * Helper to get PermissionGroup IDs by domain name (sidebar grouping)
 */
export async function getGroupsByDomain(domainName) {
    const groups = await PermissionGroupModel.find({ domain: domainName });
    return groups.map((g) => g.permissionGroupId);
}
/**
 * Helper to get all PermissionGroup IDs
 */
export async function getAllGroupIds() {
    const groups = await PermissionGroupModel.find({});
    return groups.map((g) => g.permissionGroupId);
}
//# sourceMappingURL=permission-group.seeder.js.map