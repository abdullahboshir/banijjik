import { Router, Request, Response } from 'express';
import { 
  UserController, 
  MongooseUserRepository,
  BcryptPasswordService,
  JwtService
} from '../../index'; // infrastructure layer index
import { CreateUserUseCase, LoginUseCase, RegisterUserHandler, LoginHandler } from '@identity/application';
import { UniqueEmailPolicy, PasswordStrengthPolicy } from '@identity/domain';

export const createUserRouter = (userRepository: MongooseUserRepository) => {
  const router = Router();
  
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
    passwordStrengthPolicy
  );
  const loginUseCase = new LoginUseCase(userRepository, passwordService, jwtService);

  // 4. Handlers (Orchestration Layer)
  const registerUserHandler = new RegisterUserHandler(createUserUseCase);
  const loginHandler = new LoginHandler(loginUseCase);

  // 5. Controller (Interface Layer)
  const userController = new UserController(registerUserHandler, loginHandler);

  // 6. Routes
  router.post('/register', (req: Request, res: Response) => userController.create(req, res));
  router.post('/login', (req: Request, res: Response) => userController.login(req, res));

  return router;
};
