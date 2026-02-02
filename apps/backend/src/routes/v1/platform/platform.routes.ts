import { Router } from "express";
import { createTenantsRouter } from "./tenants.routes";
import { createSystemRouter } from "./system.routes";
import { createStaffRouter } from "./staff.routes";

const router = Router();

// =============================================================================
// PLATFORM CONTEXT ROUTER (Resource-Based Aggregation)
// =============================================================================
// Context-level guards (e.g., AuthGuard.requireContext('PLATFORM')) can be added here.

router.use("/tenants", createTenantsRouter());
router.use("/system", createSystemRouter());
router.use("/staff", createStaffRouter());

export { router as platformRouter };
