import { RoleModel } from "../models/role.model";
import { PermissionGroupModel } from "../models/permission-group.model";
import { USER_ROLE, PERMISSION_SCOPE } from "@banijjik/contracts";
import { Types } from "mongoose";

/**
 * 🏢 Level 2: Organization Roles
 * These are system-standard roles available to all organizations.
 */
export async function seedOrganizationRoles() {
  console.log("📡 Step 4: Syncing Organization-Level Roles...");

  const allGroups = await PermissionGroupModel.find({});

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
      name: USER_ROLE.ORGANIZATION_OWNER,
      description: "Full organization access and management",
      ...getGroupsAndPermissions([
        "organization",
        "billing",
        "inventory",
        "ordering",
      ]),
      roleScope: PERMISSION_SCOPE.ORGANIZATION,
      hierarchyLevel: 90,
      isSystem: true,
      key: "organization_owner_org",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.ADMIN,
      description: "Organization administrator with full operational access",
      ...getGroupsAndPermissions(["organization", "inventory", "ordering"]),
      roleScope: PERMISSION_SCOPE.ORGANIZATION,
      hierarchyLevel: 80,
      isSystem: true,
      key: "admin_org",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.MANAGER,
      description: "Department or team manager",
      ...getGroupsAndPermissions(["inventory", "ordering"]),
      roleScope: PERMISSION_SCOPE.ORGANIZATION,
      hierarchyLevel: 60,
      isSystem: true,
      key: "manager_org",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.STAFF,
      description: "Standard staff member with operational access",
      ...getGroupsAndPermissions(["ordering"]),
      roleScope: PERMISSION_SCOPE.ORGANIZATION,
      hierarchyLevel: 40,
      isSystem: true,
      key: "staff_org",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.CONSUMER,
      description: "End customer with limited self-service access",
      permissionGroups: [] as string[],
      permissions: [] as string[],
      roleScope: PERMISSION_SCOPE.SELF,
      hierarchyLevel: 10,
      isSystem: true,
      key: "consumer_self",
    },
    {
      roleId: crypto.randomUUID(),
      name: USER_ROLE.VIEWER,
      description: "Read-only access for auditing purposes",
      permissionGroups: [] as string[],
      permissions: [] as string[],
      roleScope: PERMISSION_SCOPE.ORGANIZATION,
      hierarchyLevel: 5,
      isSystem: true,
      key: "viewer_org",
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
      `   ✅ Organization roles synced: ${result.upsertedCount} created, ${result.modifiedCount} updated.`,
    );
  }
}
