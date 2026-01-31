import { UserModel } from "../models/user.model";
import { RoleModel } from "../models/role.model";
import { USER_ROLE, USER_STATUS, PERMISSION_SCOPE } from "@banijjik/contracts";
import bcrypt from "bcrypt";
import "dotenv/config";
const SUPER_ADMIN_ID = "super_admin_01";
/**
 * 👤 Seeds the initial Super Admin user.
 * Expects SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in environment.
 */
export async function seedSuperAdmin() {
    console.log("👤 Step 5: Syncing Super Admin User...");
    const email = process.env.SUPER_ADMIN_EMAIL || "admin@banijjik.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "Admin123!";
    // 1. Ensure Super Admin Role exists
    const superAdminRole = await RoleModel.findOne({
        name: USER_ROLE.SUPER_ADMIN,
        roleScope: PERMISSION_SCOPE.GLOBAL,
    });
    if (!superAdminRole) {
        throw new Error("CRITICAL: SUPER_ADMIN role not found. Run platform seeder first.");
    }
    // 2. Hash Password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // 3. Upsert User
    const update = {
        id: SUPER_ADMIN_ID,
        firstName: "Super",
        lastName: "Admin",
        email: email.toLowerCase(),
        password: hashedPassword,
        status: USER_STATUS.ACTIVE,
        isActive: true,
        isSuperAdmin: true,
        globalRoles: [superAdminRole._id.toString()],
        isEmailVerified: true,
        isPhoneVerified: true,
        needsPasswordChange: false,
        metadata: {
            seededAt: new Date(),
        },
    };
    await UserModel.findOneAndUpdate({ email: email.toLowerCase() }, { $set: update }, { upsert: true, new: true });
    console.log(`   ✅ Super Admin user synced: ${email}`);
}
//# sourceMappingURL=super-admin.seeder.js.map