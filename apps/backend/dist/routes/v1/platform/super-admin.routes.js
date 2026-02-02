import { Router } from "express";
export const createSuperAdminRouter = () => {
    const router = Router();
    // router.use(GlobalGuard.allowRoles(USER_ROLE.SUPER_ADMIN));
    // Example: router.get("/tenants", ...);
    return router;
};
//# sourceMappingURL=super-admin.routes.js.map