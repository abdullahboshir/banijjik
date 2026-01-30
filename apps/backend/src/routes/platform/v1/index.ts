import { Router } from "express";
import { createPeopleRouter } from "../../../domains/core/people/presentation/routes/people.routes";
import { createUserRouter } from "../../../domains/core/iam/presentation/routes/user.routes";
import { MongooseUserRepository } from "../../../domains/core/iam/infrastructure/persistence/mongoose/repositories/user.repository.impl";

const v1Router = Router();

// =============================================================================
// DOMAIN ROUTES MOUNTING
// =============================================================================

// 1. Identity Domain (Auth & Users)
const userRepository = new MongooseUserRepository();
v1Router.use("/users", createUserRouter(userRepository));

// 2. People Domain (Global Users)
v1Router.use("/people", createPeopleRouter());

// 3. Organization Domain - Placeholder
// v1Router.use("/organizations", createOrganizationRouter());

export { v1Router };
