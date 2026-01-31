import { syncPermissions } from "./iam.seeder";
import {
  syncPermissionGroups,
  getAllGroupIds,
} from "./permission-group.seeder";
import { seedPlatformRoles } from "./platform.seeder";
import { seedOrganizationRoles } from "./organization.seeder";
import { seedSuperAdmin } from "./super-admin.seeder";

/**
 * 🚀 Main Seeder Orchestrator
 * Run in strict order due to dependencies between stages.
 */
export async function runAllSeeders() {
  console.log("--- 🏗️ Starting Authorization Seeder ---");

  try {
    // 1. Sync all Resource:Action permissions
    await syncPermissions();

    // 2. Sync permission groups (depends on permissions)
    await syncPermissionGroups();

    // 3. Seed platform-level roles (depends on permission groups)
    await seedPlatformRoles();

    // 4. Seed organization-level roles (depends on permission groups)
    await seedOrganizationRoles();

    // 5. Seed the Super Admin user (depends on SUPER_ADMIN role)
    await seedSuperAdmin();

    console.log("--- ✅ Authorization Seeder Completed Successfully ---");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}
