import { Router } from "express";
import { createPersonRouter } from "@person/presentation";
export const createStaffRouter = (repository) => {
    const router = Router();
    // =============================================================================
    // STAFF ROUTES (Platform Context)
    // =============================================================================
    // Routing to the Person domain which handles staff/people related logic
    router.use("/", createPersonRouter(repository));
    return router;
};
//# sourceMappingURL=staff.routes.js.map