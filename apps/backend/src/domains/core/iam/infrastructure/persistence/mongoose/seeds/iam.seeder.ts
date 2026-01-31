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

  for (const resource of resources) {
    const domain = getDomainByResource(resource);

    for (const action of actions) {
      const id = `${resource}:${action}`;
      const description = `Permission to ${action.toLowerCase()} ${resource.toLowerCase().replace("_", " ")}`;

      ops.push({
        updateOne: {
          filter: { id },
          update: {
            $set: {
              id,
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
    const result = await PermissionModel.bulkWrite(ops);
    console.log(
      `   ✅ Permissions synced: ${result.upsertedCount} created, ${result.modifiedCount} updated.`,
    );
  }
}
