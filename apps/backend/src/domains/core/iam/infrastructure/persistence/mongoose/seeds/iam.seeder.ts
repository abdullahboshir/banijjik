import { PermissionModel } from "../models/permission.model";
import {
  PERMISSION_RESOURCE,
  PERMISSION_ACTION,
  PERMISSION_SCOPE,
  PERMISSION_EFFECT,
  PermissionResourceType,
  PermissionActionType,
  getDomainByResource,
} from "@banijjik/contracts";

// ═══════════════════════════════════════════════════════════════
// Step 1: Sync All Permissions
// ═══════════════════════════════════════════════════════════════
export async function syncPermissions() {
  console.log("🛠️  Step 1: Syncing All Permissions...");

  const resources = Object.values(
    PERMISSION_RESOURCE,
  ) as PermissionResourceType[];
  const actions = Object.values(PERMISSION_ACTION) as PermissionActionType[];

  const ops = [];
  const activePermissionIds: string[] = [];

  for (const resource of resources) {
    const domain = getDomainByResource(resource);

    for (const action of actions) {
      const permissionId = `${resource}:${action}`;
      activePermissionIds.push(permissionId);
      const description = `Permission to ${action.toLowerCase()} ${resource.toLowerCase().replace("_", " ")}`;

      ops.push({
        updateOne: {
          filter: { permissionId },
          update: {
            $set: {
              permissionId,
              domain,
              resource,
              action,
              scope: PERMISSION_SCOPE.GLOBAL,
              effect: PERMISSION_EFFECT.ALLOW,
              description,
              isActive: true,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length > 0) {
    const result = await PermissionModel.bulkWrite(ops, { ordered: false });
    console.log(
      `   ✅ Permissions synced: ${result.upsertedCount} created, ${result.modifiedCount} updated.`,
    );
  }

  // Cleanup: Remove permissions that no longer exist in code
  const deleteResult = await PermissionModel.deleteMany({
    permissionId: { $nin: activePermissionIds },
  });
  if (deleteResult.deletedCount > 0) {
    console.log(
      `   🗑️  Removed ${deleteResult.deletedCount} stale permissions.`,
    );
  }
}
