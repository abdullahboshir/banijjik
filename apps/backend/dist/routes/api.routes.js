import { Router } from "express";
import { v1Routes } from "./v1";
const router = Router();
router.use("/v1", v1Routes);
export const apiRouter = router;
//# sourceMappingURL=api.routes.js.map