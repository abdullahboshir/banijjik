import { Router } from "express";
import { createStorefrontRouter } from "@storefront/presentation";

const router = Router();

// =============================================================================
// ORGANIZATION CONTEXT ROUTER (Industrial Aggregation)
// =============================================================================
// All tenant/organization scoped routes are mounted here.
// Tenant resolution middleware should be applied to this router.

router.use("/storefront", createStorefrontRouter());

export { router as organizationRouter };
