import { Router } from "express";
import storefrontRoutes from "../../../domains/core/storefront/presentation/routes/storefront.routes";
const v1Router = Router();
// =============================================================================
// DOMAIN ROUTES MOUNTING
// =============================================================================
// 1. Storefront Domain
v1Router.use("/storefront", storefrontRoutes);
export { v1Router };
//# sourceMappingURL=index.js.map