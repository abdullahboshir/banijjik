import { UserModel } from "../models/user.model";
import { RoleModel } from "../models/role.model";
import { USER_ROLE, USER_STATUS, PERMISSION_SCOPE } from "@banijjik/contracts";
import bcrypt from "bcrypt";
import { appConfig } from "../../../../../../../config/app.config";
const SUPER_ADMIN_ID = crypto.randomUUID();
/**
 * 👤 Seeds the initial Super Admin user.
 * Expects SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASS in environment.
 */
export async function seedSuperAdmin() {
    console.log("👤 Step 5: Syncing Super Admin User...");
    const email = appConfig.super_admin_email;
    const password = appConfig.super_admin_pass;
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
    // 3. Migration: If existing user has legacy string _id, delete it to allow ObjectId generation
    // Use collection to bypass Mongoose ObjectId casting for the legacy string ID
    const coreCollection = UserModel.collection;
    const existingLegacyUser = await coreCollection.findOne({
        _id: SUPER_ADMIN_ID,
    });
    if (existingLegacyUser) {
        console.log("   ⚠️  Found legacy string ID for Super Admin. Migrating to ObjectId...");
        await coreCollection.deleteOne({ _id: SUPER_ADMIN_ID });
    }
    // 4. Upsert User
    const update = {
        userId: SUPER_ADMIN_ID,
        firstName: "Super",
        lastName: "Admin",
        email: email.toLowerCase(),
        password: hashedPassword,
        status: USER_STATUS.ACTIVE,
        isActive: true,
        isSuperAdmin: true,
        systemRoles: [superAdminRole._id.toString()],
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