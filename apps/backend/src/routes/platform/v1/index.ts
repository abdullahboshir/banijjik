import { Router } from "express";
import { createPeopleRouter } from "../../../domains/core/people/infrastructure/http/routes/people.routes";

const v1Router = Router();

// =============================================================================
// DOMAIN ROUTES MOUNTING
// =============================================================================

// 1. People Domain (Global Users)
v1Router.use("/people", createPeopleRouter());

// 2. Identity Domain (Auth) - Placeholder
// v1Router.use("/auth", createIdentityRouter());

// 3. Organization Domain - Placeholder
// v1Router.use("/organizations", createOrganizationRouter());

export { v1Router };
