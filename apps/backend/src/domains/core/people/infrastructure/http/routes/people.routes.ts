import { Router } from "express";
import { MongoosePeopleImplRepository } from "../../persistence";
import { JoinOrganizationUseCase } from "@people/application";
import { PeopleController } from "../controllers";

export const createPeopleRouter = () => {
  const router = Router();

  // 1. Repositories
  const peopleRepo = new MongoosePeopleImplRepository();

  // 2. Use Cases
  const joinOrgUseCase = new JoinOrganizationUseCase(peopleRepo);

  // 3. Controller
  const controller = new PeopleController(joinOrgUseCase);

  // 4. Routes
  router.post("/join", controller.joinOrganization.bind(controller));

  return router;
};
