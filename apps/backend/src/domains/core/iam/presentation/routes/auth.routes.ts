import { Router, Request, Response } from "express";
import { UserController } from "../controllers/auth.controller";
import { MongooseUserRepository } from "../../infrastructure/persistence";
import {
  BcryptPasswordService,
  JwtService,
} from "../../infrastructure/services";
import { CreateUserUseCase, LoginUseCase } from "@iam/application";
import { UniqueEmailPolicy, PasswordStrengthPolicy } from "@iam/domain";

export const createIamRouter = (userRepository: MongooseUserRepository) => {
  const router = Router();

  console.log("userRepository", userRepository);
  // 1. Core Services (Infrastructure)
  const passwordService = new BcryptPasswordService();
  const jwtService = new JwtService();

  // 2. Domain Policies
  const uniqueEmailPolicy = new UniqueEmailPolicy(userRepository);
  const passwordStrengthPolicy = new PasswordStrengthPolicy();

  // 3. Use Cases (Application Layer)
  const createUserUseCase = new CreateUserUseCase(
    userRepository,
    passwordService,
    uniqueEmailPolicy,
    passwordStrengthPolicy,
  );

  const loginUseCase = new LoginUseCase(
    userRepository,
    passwordService,
    jwtService,
  );

  // 4. Controller (Interface Layer)
  const userController = new UserController(createUserUseCase, loginUseCase);

  // 6. Routes
  router.post("/register", (req: Request, res: Response) =>
    userController.create(req, res),
  );
  router.post("/login", (req: Request, res: Response) =>
    userController.login(req, res),
  );

  return router;
};
