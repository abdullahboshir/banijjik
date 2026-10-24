import { asId, type ContactId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
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
import type { CustomerErasureResult } from "./application/ports/customer-participants.js";
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

function requireContactId(account: { contactId: ContactId } | undefined): ContactId {
  if (account === undefined) throw new Error("account missing");
  return account.contactId;
}

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

    // Writes first (sessions deleted, contact anonymized) and only then fails, so the rollback has
    // real data to undo.
    const writingThenFailingParticipant = {
      async eraseForAccount(input: {
        customerAccountId: CustomerAccountId;
      }): Promise<CustomerErasureResult> {
        await sessions.deleteAllOfAccount(input.customerAccountId);
        const account = await accounts.findById(input.customerAccountId);
        const contact =
          account === undefined ? undefined : await contacts.findById(account.contactId);
        if (contact !== undefined) {
          await contacts.update(contact.anonymize(harness.clock.now()), contact.version, null);
        }
        throw new Error("Simulated participant failure");
      },
    };

    const dependencies = {
      accounts,
      contacts,
      challenges,
      sessions,
      audit,
      events: kernelEventPublisher,
      clock: harness.clock,
      otpSecret: TEST_OTP_SECRET,
      unitOfWork: new MongoUnitOfWork(),
    };
    const failingUseCase = new EraseOwnCustomerAccountUseCase({
      ...dependencies,
      erasureParticipants: [writingThenFailingParticipant],
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

      // 1b. The sessions the participant deleted are back, and the contact is not anonymized
      const sessionRows = await harness.connections.tenantShared
        .collection("customer_sessions")
        .find({ customerAccountId })
        .toArray();
      expect(sessionRows.length).toBeGreaterThan(0);
      const contact = await contacts.findById(requireContactId(account));
      expect(contact?.anonymizedAt).toBeUndefined();
      expect(contact?.phoneE164).toBe(phoneE164);

      // 2. Challenge was NOT consumed
      const challenge = await challenges.findById(challengeId);
      expect(challenge).toBeDefined();
      expect(challenge?.consumedAt).toBeUndefined();
    });

    // The same code still works once the participants succeed: a failed erase wastes no code.
    const workingUseCase = new EraseOwnCustomerAccountUseCase({
      ...dependencies,
      erasureParticipants: [{ eraseForAccount: async () => ({ forfeitedCredits: 0 }) }],
    });
    const result = await withOrganizationContext(world.organizationA, () =>
      workingUseCase.execute({
        organizationId: asId<OrganizationId>(world.organizationA),
        customerAccountId: asId<CustomerAccountId>(customerAccountId),
        challengeId,
        code,
      }),
    );
    expect(result.erased).toBe(true);
  });
});
