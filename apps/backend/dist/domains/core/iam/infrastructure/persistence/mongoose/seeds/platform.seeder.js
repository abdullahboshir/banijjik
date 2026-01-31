import { RoleModel } from "../models/role.model";
import { PermissionGroupModel } from "../models/permission-group.model";
import { USER_ROLE, PERMISSION_SCOPE } from "@banijjik/contracts";
/**
 * 🔴 Level 1: Platform Roles (Global Scope)
 * Scoped to the entire system (organization: null)
 */
export async function seedPlatformRoles() {
    console.log("📡 Step 3: Syncing Platform-Level Roles...");
    // Get all permission groups with their permissions populated
    const allGroups = await PermissionGroupModel.find({});
    const fullAccessGroup = allGroups.find((g) => g.name === "system.full_access");
    // Helper: Get groups by domain and return both group IDs and flattened permission IDs
    const getGroupsAndPermissions = (domainNames) => {
        const groups = allGroups.filter((g) => domainNames.includes(g.domain));
        const permissionGroups = groups.map((g) => g._id);
        const permissions = groups.flatMap((g) => g.permissions);
        return { permissionGroups, permissions };
    };
    const roleConfigs = [
        {
            name: USER_ROLE.SUPER_ADMIN,
            description: "Full system access with all permissions",
            permissionGroups: fullAccessGroup
                ? [fullAccessGroup._id]
                : allGroups.map((g) => g._id),
            permissions: fullAccessGroup
                ? fullAccessGroup.permissions
                : allGroups.flatMap((g) => g.permissions),
            roleScope: PERMISSION_SCOPE.GLOBAL,
            hierarchyLevel: 100,
            isSystemRole: true,
        },
        {
            name: USER_ROLE.PLATFORM_ADMIN,
            description: "Platform administration and user management",
            ...getGroupsAndPermissions([
                "iam",
                "organization",
                "platform",
                "billing",
            ]),
            roleScope: PERMISSION_SCOPE.PLATFORM,
            hierarchyLevel: 95,
            isSystemRole: true,
        },
        {
            name: USER_ROLE.PLATFORM_SUPPORT,
            description: "Customer support and read-only access",
            ...getGroupsAndPermissions(["organization"]),
            roleScope: PERMISSION_SCOPE.PLATFORM,
            hierarchyLevel: 80,
            isSystemRole: true,
        },
        {
            name: USER_ROLE.PLATFORM_ACCOUNTING,
            description: "Financial operations and billing management",
            ...getGroupsAndPermissions(["billing"]),
            roleScope: PERMISSION_SCOPE.PLATFORM,
            hierarchyLevel: 80,
            isSystemRole: true,
        },
    ];
    const ops = roleConfigs.map((role) => ({
        updateOne: {
            filter: { name: role.name, roleScope: role.roleScope },
            update: {
                $set: {
                    name: role.name,
                    description: role.description,
                    permissions: role.permissions,
                    permissionGroups: role.permissionGroups,
                    isSystemRole: role.isSystemRole,
                    roleScope: role.roleScope,
                    isActive: true,
                    hierarchyLevel: role.hierarchyLevel,
                    organization: null,
                },
            },
            upsert: true,
        },
    }));
    if (ops.length > 0) {
        const result = await RoleModel.bulkWrite(ops);
        console.log(`   ✅ Platform roles synced: ${result.upsertedCount} created, ${result.modifiedCount} updated.`);
    }
}
//# sourceMappingURL=platform.seeder.js.map