import { Router } from "express";
import { StorefrontController } from "../controllers/storefront.controller";
const router = Router();
// Public routes
router.get("/public/:slug", StorefrontController.getPublicStorefront);
// Admin routes (Protected by middleware in main router)
router.get("/admin", StorefrontController.getAdminStorefront);
router.patch("/admin", StorefrontController.updateStorefront);
export default router;
//# sourceMappingURL=storefront.routes.js.map