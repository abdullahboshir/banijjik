import { Router } from "express";
import { v1Routes } from "./v1";

const router = Router();

// =============================================================================
// MAIN API ROUTER (Top Level Gateway)
// =============================================================================

router.use("/v1", v1Routes);

export { router as apiRouter };
