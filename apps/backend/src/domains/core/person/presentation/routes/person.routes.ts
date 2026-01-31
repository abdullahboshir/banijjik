import { Router } from "express";

import { JoinOrganizationUseCase } from "@person/application";
import { PersonController } from "../controllers";
import { MongoosePersonRepository } from "@person/infrastructure";

export const createPersonRouter = () => {
  const router = Router();

  // 1. Repositories
  const personRepo = new MongoosePersonRepository();

  // 2. Use Cases
  const joinOrgUseCase = new JoinOrganizationUseCase(personRepo);

  // 3. Controller
  const controller = new PersonController(joinOrgUseCase);

  // 4. Routes
  router.post("/join", controller.joinOrganization.bind(controller));

  return router;
};
