import { asId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { buildAuditRecorder } from "../../core/audit/index.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../test-support/module-contract/contract-template-reader.js";
import {
  asCustomerCookies,
  callStorefront,
  deliverPendingOtpSms,
  enableCustomerLogin,
  latestCode,
  signInCustomer,
  TEST_OTP_SECRET,
} from "../../../test-support/storefront-world.js";
import { createTwoOrganizations } from "../../../test-support/two-organizations.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import { EraseOwnCustomerAccountUseCase } from "./application/use-cases/erase-own-customer-account.use-case.js";
import { MongoCustomerAccountRepository } from "./infrastructure/mongo-customer-account.repository.js";
import { MongoCustomerSessionRepository } from "./infrastructure/mongo-customer-session.repository.js";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";
import { MongoOtpChallengeRepository } from "./infrastructure/mongo-otp-challenge.repository.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ templateReader, tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

describe("Erase Transaction Rollback", () => {
  it("rolls back all changes and keeps OTP challenge valid if a participant throws", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCustomerLogin(world, world.organizationA);

    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);
    const customerAccountId = customer.verifyResponse.body.data.customerAccountId as string;
    const phoneE164 = `+88${customer.phone}`;

    // Request erase OTP
    const otpRes = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/account/erase/otp",
      cookies,
    });
    const challengeId = otpRes.body.data.challengeId as string;
    await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
    const code = await latestCode(world.organizationA, phoneE164);

    // Instantiate EraseOwnCustomerAccountUseCase with a failing participant
    const accounts = new MongoCustomerAccountRepository();
    const contacts = new MongoContactRepository();
    const challenges = new MongoOtpChallengeRepository();
    const sessions = new MongoCustomerSessionRepository();
    const audit = buildAuditRecorder(harness.clock);

    const failingParticipant = {
      async eraseForAccount() {
        throw new Error("Simulated participant failure");
      },
    };

    const failingUseCase = new EraseOwnCustomerAccountUseCase({
      accounts,
      contacts,
      challenges,
      sessions,
      audit,
      events: kernelEventPublisher,
      clock: harness.clock,
      erasureParticipants: [failingParticipant],
      exportParticipants: [],
      otpSecret: TEST_OTP_SECRET,
      unitOfWork: new MongoUnitOfWork(),
      limiter: { isRateLimited: async () => false } as never,
      tokens: { issueAccessToken: () => "", verifyAccessToken: () => null } as never,
    });

    // Execute use case and expect failure
    await expect(
      withOrganizationContext(world.organizationA, () =>
        failingUseCase.execute({
          organizationId: asId<OrganizationId>(world.organizationA),
          customerAccountId: asId<CustomerAccountId>(customerAccountId),
          challengeId,
          code,
        }),
      ),
    ).rejects.toThrow("Simulated participant failure");

    // Verify transaction rollback:
    await withOrganizationContext(world.organizationA, async () => {
      // 1. Account still exists
      const account = await accounts.findById(asId<CustomerAccountId>(customerAccountId));
      expect(account).toBeDefined();

      // 2. Challenge was NOT consumed
      const challenge = await challenges.findById(challengeId);
      expect(challenge).toBeDefined();
      expect(challenge?.consumedAt).toBeUndefined();
    });
  });
});
