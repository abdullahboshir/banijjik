import { Router } from "express";
import { createPersonRouter } from "@person/presentation";
import { MongoosePersonRepository } from "@person/infrastructure";

export const createStaffRouter = (repository?: MongoosePersonRepository) => {
  const router = Router();

  // =============================================================================
  // STAFF ROUTES (Platform Context)
  // =============================================================================
  // Routing to the Person domain which handles staff/people related logic
  router.use("/", createPersonRouter(repository));

  return router;
};
