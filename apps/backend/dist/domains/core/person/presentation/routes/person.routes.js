import { Router } from "express";
import { PersonController } from "../controllers";
import { MongoosePersonRepository } from "@person/infrastructure";
export const createPersonRouter = (repository) => {
    const router = Router();
    // 1. Repositories
    const personRepo = repository || new MongoosePersonRepository();
    // 2. Use Cases
    // 3. Controller
    const controller = new PersonController();
    // 4. Routes
    return router;
};
//# sourceMappingURL=person.routes.js.map