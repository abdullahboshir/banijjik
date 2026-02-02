import mongoose from "mongoose";
import { appConfig } from "../config/app.config";
import { CreateOrganizationUseCase } from "../domains/core/organization/application/use-cases/create-organization.use-case";
import { MongooseOrganizationRepository } from "../domains/core/organization/infrastructure/persistence/mongoose/repositories/organization.repository.impl";
import { IamServiceAdapter } from "../domains/core/organization/infrastructure/adapters/iam.adapter";
import { IMailService } from "../shared/application/ports/mail.port";
import { MongooseUserRepository } from "../domains/core/iam/infrastructure/persistence/mongoose/repositories/user.repository.impl";
import { CreateUserUseCase } from "../domains/core/iam/application/use-cases/create-user.use-case";
import { BcryptPasswordService } from "../domains/core/iam/infrastructure/services/bcrypt-password.service";
import { JwtService } from "../domains/core/iam/infrastructure/services/jwt.service";
import { UniqueEmailPolicy, PasswordStrengthPolicy } from "@iam/domain";
import { CreateOrganizationMembershipUseCase } from "../domains/core/iam/application/use-cases/create-organization-membership.use-case";
import { MongooseOrganizationMembershipRepository } from "../domains/core/iam/infrastructure/persistence/mongoose/repositories/organization-membership.repository.impl";

// Mock Mail Service
class MockMailService implements IMailService {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    console.log("---------------------------------------------------");
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: ${subject}`);
    console.log(`[MOCK EMAIL] Body: (HTML Content)`);
    console.log("---------------------------------------------------");
    return true;
  }
  async sendWelcomeEmail(
    to: string,
    ownerName: string,
    setupUrl: string,
  ): Promise<boolean> {
    console.log("---------------------------------------------------");
    console.log(`[MOCK WELCOME EMAIL] To: ${to}`);
    console.log(`[MOCK WELCOME EMAIL] Name: ${ownerName}`);
    console.log(`[MOCK WELCOME EMAIL] Link: ${setupUrl}`);
    console.log("---------------------------------------------------");
    return true;
  }
}

async function verify() {
  await mongoose.connect(appConfig.db_url);
  console.log("Connected to DB");

  const userRepo = new MongooseUserRepository();
  const orgRepo = new MongooseOrganizationRepository();
  const membershipRepo = new MongooseOrganizationMembershipRepository();
  const mailService = new MockMailService();

  const passwordService = new BcryptPasswordService();
  const jwtService = new JwtService();
  const uniqueEmailPolicy = new UniqueEmailPolicy(userRepo);
  const passwordStrengthPolicy = new PasswordStrengthPolicy();

  const createUserUseCase = new CreateUserUseCase(
    userRepo,
    passwordService,
    uniqueEmailPolicy,
    passwordStrengthPolicy,
  );

  const createMembershipUseCase = new CreateOrganizationMembershipUseCase(
    membershipRepo,
  );

  const iamAdapter = new IamServiceAdapter(
    createUserUseCase,
    createMembershipUseCase,
    jwtService,
  );

  const useCase = new CreateOrganizationUseCase(
    orgRepo,
    iamAdapter,
    mailService,
  );

  const mockDto = {
    name: "Verification Corp " + Date.now(),
    email: `verify_${Date.now()}@example.com`,
    phone: "1234567890",
    ownerFirstName: "Verify",
    ownerLastName: "User",
    address: "123 Test Lane",
    // Manually adding defaults that Zod would have provided
    industry: "IT" as any,
    legalType: "PROPRIETORSHIP" as any,
    nature: "SERVICE" as any,
    currency: "BDT" as any,
  };

  try {
    console.log("Executing UseCase...");
    const result = await useCase.execute(mockDto);
    console.log("Result:", result);
  } catch (error) {
    console.error("Verification Failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
