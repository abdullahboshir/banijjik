import { Router } from "express";
import {
  createIamRouter,
  createAuthenticateMiddleware,
  authorize,
} from "@iam/presentation";
import { MongooseUserRepository, JwtService } from "@iam/infrastructure";
import { createPersonRouter } from "@person/presentation";
import { MongoosePersonRepository } from "@person/infrastructure";
import { createOrganizationRouter } from "../../domains/core/organization/presentation/routes/organization.routes.js";

// Context Routers (Resource-Based)
import { platformRouter } from "./platform/index.js";

const router = Router();
const userRepository = new MongooseUserRepository();
const personRepository = new MongoosePersonRepository();
const jwtService = new JwtService();

// 1. Auth Middleware Initialization
const authenticate = createAuthenticateMiddleware(jwtService, userRepository);

// =============================================================================
// 1. PUBLIC & AUTH SERVICE (Global)
// =============================================================================

router.use("/auth", createIamRouter(userRepository));

// =============================================================================
// 2. PROTECTED ROUTES (Require Login)
// =============================================================================

router.use("/people", authenticate, createPersonRouter(personRepository));
router.use("/platform", authenticate, platformRouter);
router.use(
  "/organization",
  authenticate,
  createOrganizationRouter(userRepository),
);

export const v1Routes = router;
export { authenticate, authorize };
