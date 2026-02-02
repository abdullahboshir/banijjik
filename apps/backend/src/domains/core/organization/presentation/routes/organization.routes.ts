import { Router, Request, Response } from "express";
import { OrganizationController } from "../controllers/organization.controller";
import { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case";
import { MongooseOrganizationRepository } from "../../infrastructure/persistence/mongoose/repositories/organization.repository.impl";
import { IamServiceAdapter } from "../../infrastructure/adapters/iam.adapter";

// IAM Imports for DI construction
import { MongooseUserRepository } from "../../../iam/infrastructure/persistence/mongoose/repositories/user.repository.impl";
import { MongooseOrganizationMembershipRepository } from "../../../iam/infrastructure/persistence/mongoose/repositories/organization-membership.repository.impl";
import { BcryptPasswordService } from "../../../iam/infrastructure/services/bcrypt-password.service";
import { JwtService } from "../../../iam/infrastructure/services/jwt.service";
import { CreateUserUseCase } from "../../../iam/application/use-cases/create-user.use-case";
import { CreateOrganizationMembershipUseCase } from "../../../iam/application/use-cases/create-organization-membership.use-case";
import { CreatePersonUseCase } from "../../../person/application/use-cases/create-person.use-case";
import { UniqueEmailPolicy, PasswordStrengthPolicy } from "@iam/domain";
import { MongoosePersonRepository } from "../../../person/infrastructure/persistence/mongoose/person.repository.impl";
import { CreateOrganizationOwnershipUseCase } from "../../application/use-cases/create-organization-ownership.use-case";
import { MongooseOrganizationOwnershipRepository } from "../../infrastructure/persistence/mongoose/repositories/organization-ownership.repository.impl";

// Shared Imports
import { MailService } from "../../../../../infrastructure/services/mail/mail.service";

export const createOrganizationRouter = (
  userRepository: MongooseUserRepository,
) => {
  const router = Router();

  // 1. IAM Dependencies (Infrastructure & Core)
  const passwordService = new BcryptPasswordService();
  const jwtService = new JwtService();
  const uniqueEmailPolicy = new UniqueEmailPolicy(userRepository);
  const passwordStrengthPolicy = new PasswordStrengthPolicy();

  // 2. IAM Use Cases (Internal for Adapter)
  const createUserUseCase = new CreateUserUseCase(
    userRepository,
    passwordService,
    uniqueEmailPolicy,
    passwordStrengthPolicy,
  );

  const organizationMembershipRepository =
    new MongooseOrganizationMembershipRepository();
  const createMembershipUseCase = new CreateOrganizationMembershipUseCase(
    organizationMembershipRepository,
  );

  const personRepository = new MongoosePersonRepository();
  const createPersonUseCase = new CreatePersonUseCase(personRepository);

  const organizationOwnershipRepository =
    new MongooseOrganizationOwnershipRepository();
  const createOrganizationOwnershipUseCase =
    new CreateOrganizationOwnershipUseCase(organizationOwnershipRepository);

  // 3. Organization Dependencies
  const iamAdapter = new IamServiceAdapter(
    createUserUseCase,
    createMembershipUseCase,
    createPersonUseCase,
    createOrganizationOwnershipUseCase,
    jwtService,
  );
  const organizationRepository = new MongooseOrganizationRepository();
  const mailService = new MailService();

  // 4. Use Case
  const createOrganizationUseCase = new CreateOrganizationUseCase(
    organizationRepository,
    iamAdapter,
    mailService,
  );

  // 5. Controller
  const controller = new OrganizationController(createOrganizationUseCase);

  // 6. Routes
  router.post("/", (req: Request, res: Response) =>
    controller.create(req, res),
  );

  return router;
};
