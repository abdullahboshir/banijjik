import { RoleModel } from "../models/role.model";
import { PermissionGroupModel } from "../models/permission-group.model";
import { USER_ROLE, PERMISSION_SCOPE } from "@banijjik/contracts";
import { Types } from "mongoose";

/**
 * 🔴 Level 1: Platform Roles (Global Scope)
 * Scoped to the entire system (organization: null)
 */
export async function seedPlatformRoles() {
  console.log("📡 Step 3: Syncing Platform-Level Roles...");

  // Get all permission groups with their permissions populated
  const allGroups = await PermissionGroupModel.find({});
  const fullAccessGroup = allGroups.find(
    (g) => g.name === "system:full_access",
  );

  // Helper: Get groups by domain and return both group IDs and flattened permission IDs (all strings)
  const getGroupsAndPermissions = (domainNames: string[]) => {
    const groups = allGroups.filter((g) => domainNames.includes(g.domain));
    const permissionGroups = groups.map((g) => g.permissionGroupId);
    const permissions = groups.flatMap((g) => g.permissions);
    return { permissionGroups, permissions };
  };

  const roleConfigs = [
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.SUPER_ADMIN,
      description: "Full system access with all permissions",
      permissionGroups: fullAccessGroup
        ? [fullAccessGroup.permissionGroupId]
        : allGroups.map((g) => g.permissionGroupId),
      permissions: fullAccessGroup
        ? fullAccessGroup.permissions
        : allGroups.flatMap((g) => g.permissions),
      roleScope: PERMISSION_SCOPE.GLOBAL,
      hierarchyLevel: 100,
      isSystem: true,
      key: "super_admin_global",
    },
    {
      roleId: crypto.randomUUID(),
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
      isSystem: true,
      key: "platform_admin_platform",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.PLATFORM_SUPPORT,
      description: "Customer support and read-only access",
      ...getGroupsAndPermissions(["organization"]),
      roleScope: PERMISSION_SCOPE.PLATFORM,
      hierarchyLevel: 80,
      isSystem: true,
      key: "platform_support_platform",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.PLATFORM_ACCOUNTING,
      description: "Financial operations and billing management",
      ...getGroupsAndPermissions(["billing"]),
      roleScope: PERMISSION_SCOPE.PLATFORM,
      hierarchyLevel: 80,
      isSystem: true,
      key: "platform_accounting_platform",
    },
  ];

  const ops = roleConfigs.map((role) => ({
    updateOne: {
      filter: { name: role.name, roleScope: role.roleScope },
      update: {
        $set: {
          roleId: role.roleId,
          name: role.name,
          key: role.key,
          description: role.description,
          permissions: role.permissions,
          permissionGroups: role.permissionGroups,
          isSystem: role.isSystem,
          roleScope: role.roleScope,
          isActive: true,
          hierarchyLevel: role.hierarchyLevel,
          organizationId: null,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    const result = await RoleModel.bulkWrite(ops as any);
    console.log(
      `   ✅ Platform roles synced: ${result.upsertedCount} created, ${result.modifiedCount} updated.`,
    );
  }
}
