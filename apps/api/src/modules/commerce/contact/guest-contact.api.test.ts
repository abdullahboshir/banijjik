import { CONTACT_ROLE, ERROR_CODE } from "@banijjik/contracts";
import {
  CONTACT_SOURCE,
  CONTACT_STATUS,
  CONTACT_TYPE,
  type ProvisionalContactResult,
} from "@banijjik/contracts/contact";
import { asId, newId, type ContactId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models, withTransaction } from "../../../kernel/db/index.js";
import { AppError } from "../../../kernel/http/app-error.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import type { TwoOrganizations } from "../../../test-support/two-organizations.js";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { MongoGuestSessionRepository } from "../website/index.js";
import { Contact } from "./domain/contact.entity.js";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";
import { MongoCustomerAccountRepository } from "./infrastructure/mongo-customer-account.repository.js";
import { buildProvisionalGuestContactCreator } from "./index.js";
import { findOrCreateCustomerContact } from "./application/customer-sign-in.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function createGuestSession(
  organizationId: string,
  overrides: {
    readonly guestSessionId?: string;
    readonly expiresAt?: Date;
    readonly provisionalContactId?: string | null;
  } = {},
): Promise<string> {
  const repository = new MongoGuestSessionRepository();
  const guestSessionId = overrides.guestSessionId ?? newId();
  await runInOrganizationContext(organizationId, () =>
    repository.create({
      guestSessionId,
      organizationId,
      secretHash: "sha256-test-hash",
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 86400 * 1000),
      provisionalContactId: overrides.provisionalContactId ?? null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  return guestSessionId;
}

interface RawContactDoc {
  readonly contactId: string;
  readonly organizationId: string;
  readonly name?: string;
  readonly phoneE164?: string;
  readonly source: string;
  readonly status: string;
}

interface RawGuestSessionDoc {
  readonly guestSessionId: string;
  readonly organizationId: string;
  readonly provisionalContactId: string | null;
  readonly version: number;
}

describe("safe guest contact creation (Part A3C)", () => {
  it("creates provisional contact with STOREFRONT source and null canonical phone", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const guestSessionId = await createGuestSession(world.organizationA);

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    const result = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId,
          name: "Alice Guest",
          phoneE164: "+8801712345001",
          customFields: { notes: "Leave at door" },
        }),
    );

    expect(result.contactId).toBeDefined();
    expect(result.contactSnapshot).toEqual({
      name: "Alice Guest",
      phoneE164: "+8801712345001",
      customFields: { notes: "Leave at door" },
    });

    const contacts = new MongoContactRepository();
    const contact = await runInOrganizationContext(world.organizationA, () =>
      contacts.findById(asId<ContactId>(result.contactId)),
    );

    expect(contact).toBeDefined();
    expect(contact?.source).toBe(CONTACT_SOURCE.STOREFRONT);
    expect(contact?.status).toBe(CONTACT_STATUS.ACTIVE);
    expect(contact?.name).toBe("Alice Guest");
    expect(contact?.phoneE164).toBeUndefined();
    expect(contact?.email).toBeUndefined();

    // Verify raw MongoDB document has no phoneE164 field
    const rawDoc = await runInOrganizationContext(world.organizationA, () =>
      models({})
        .get<RawContactDoc>("Contact")
        .findOne({ contactId: result.contactId })
        .lean<RawContactDoc>(),
    );
    expect(rawDoc?.phoneE164).toBeUndefined();
  });

  it("preserves unique phoneE164 index on existing active customer contacts", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const contacts = new MongoContactRepository();
    const phoneE164 = "+8801712345002";

    const contact1 = Contact.create({
      organizationId: asId<OrganizationId>(world.organizationA),
      contactType: CONTACT_TYPE.PERSON,
      name: "Customer One",
      phoneE164,
      contactRoles: [CONTACT_ROLE.CUSTOMER],
      source: CONTACT_SOURCE.STOREFRONT,
      createdByUserId: null,
      now: harness.clock.now(),
    });

    await runInOrganizationContext(world.organizationA, () => contacts.insert(contact1));

    const contact2 = Contact.create({
      organizationId: asId<OrganizationId>(world.organizationA),
      contactType: CONTACT_TYPE.PERSON,
      name: "Customer Two",
      phoneE164,
      contactRoles: [CONTACT_ROLE.CUSTOMER],
      source: CONTACT_SOURCE.STOREFRONT,
      createdByUserId: null,
      now: harness.clock.now(),
    });

    await expect(
      runInOrganizationContext(world.organizationA, () => contacts.insert(contact2)),
    ).rejects.toThrow();
  });

  it("allows multiple provisional guest contacts with the same submitted phone without conflict", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const sharedPhone = "+8801712345003";

    const sessionA = await createGuestSession(world.organizationA);
    const sessionB = await createGuestSession(world.organizationA);

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    const resultA = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId: sessionA,
          name: "Guest A",
          phoneE164: sharedPhone,
        }),
    );

    const resultB = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId: sessionB,
          name: "Guest B",
          phoneE164: sharedPhone,
        }),
    );

    expect(resultA.contactId).toBeDefined();
    expect(resultB.contactId).toBeDefined();
    expect(resultA.contactId).not.toBe(resultB.contactId);

    const contacts = new MongoContactRepository();
    const contactA = await runInOrganizationContext(world.organizationA, () =>
      contacts.findById(asId<ContactId>(resultA.contactId)),
    );
    const contactB = await runInOrganizationContext(world.organizationA, () =>
      contacts.findById(asId<ContactId>(resultB.contactId)),
    );

    expect(contactA).toBeDefined();
    expect(contactB).toBeDefined();
    expect(contactA?.phoneE164).toBeUndefined();
    expect(contactB?.phoneE164).toBeUndefined();
  });

  it("attaches provisional contactId to guest session within transaction", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const guestSessionId = await createGuestSession(world.organizationA);

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    const result1 = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId,
          name: "Session Guest",
          phoneE164: "+8801712345004",
        }),
    );

    // Verify guest session has provisionalContactId linked
    const sessionDoc = await runInOrganizationContext(world.organizationA, () =>
      models({})
        .get<RawGuestSessionDoc>("GuestSession")
        .findOne({ guestSessionId })
        .lean<RawGuestSessionDoc>(),
    );
    expect(sessionDoc?.provisionalContactId).toBe(result1.contactId);

    // Subsequent call with same session reuses existing provisional contact
    const result2 = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId,
          name: "Session Guest Updated Name",
          phoneE164: "+8801712345004",
        }),
    );

    expect(result2.contactId).toBe(result1.contactId);
    expect(result2.contactSnapshot.name).toBe("Session Guest Updated Name");
  });

  it("submitting phone of existing customer contact does not link or reveal customer contactId or history", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const existingPhone = "+8801712345005";
    const contacts = new MongoContactRepository();

    const realCustomer = Contact.create({
      organizationId: asId<OrganizationId>(world.organizationA),
      contactType: CONTACT_TYPE.PERSON,
      name: "Real Customer Rahim",
      phoneE164: existingPhone,
      contactRoles: [CONTACT_ROLE.CUSTOMER],
      source: CONTACT_SOURCE.STOREFRONT,
      createdByUserId: null,
      now: harness.clock.now(),
    });
    await runInOrganizationContext(world.organizationA, () => contacts.insert(realCustomer));

    const guestSessionId = await createGuestSession(world.organizationA);
    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    const result = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId,
          name: "Impostor or Guest",
          phoneE164: existingPhone,
        }),
    );

    // Guest gets a brand new provisional contact, never the real customer's contactId
    expect(result.contactId).not.toBe(realCustomer.contactId);

    // Real customer remains unchanged
    const customerAfter = await runInOrganizationContext(world.organizationA, () =>
      contacts.findById(realCustomer.contactId),
    );
    expect(customerAfter?.name).toBe("Real Customer Rahim");
    expect(customerAfter?.phoneE164).toBe(existingPhone);
  });

  it("customer OTP registration continues to work for a phone previously submitted by a guest", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const targetPhone = "+8801712345006";
    const guestSessionId = await createGuestSession(world.organizationA);

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    const guestResult = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId,
          name: "Guest Buyer",
          phoneE164: targetPhone,
        }),
    );

    // Later customer signs in with targetPhone
    const contacts = new MongoContactRepository();
    const customerContact = await runInOrganizationContext(world.organizationA, () =>
      withTransaction(() =>
        findOrCreateCustomerContact(
          {
            contacts,
            audit: buildAuditRecorder(harness.clock),
            events: kernelEventPublisher,
            clock: harness.clock,
          },
          {
            organizationId: asId<OrganizationId>(world.organizationA),
            phoneE164: targetPhone,
          },
        ),
      ),
    );

    expect(customerContact.contactId).not.toBe(guestResult.contactId);
    expect(customerContact.phoneE164).toBe(targetPhone);
  });

  it("provisional contact cannot be used to sign in or request customer OTP", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const phone = "+8801712345007";
    const guestSessionId = await createGuestSession(world.organizationA);

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    const guestResult = await runInOrganizationContext<ProvisionalContactResult>(
      world.organizationA,
      () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId,
          name: "Provisional Only",
          phoneE164: phone,
        }),
    );

    const accounts = new MongoCustomerAccountRepository();
    const contacts = new MongoContactRepository();

    // No CustomerAccount exists for provisional contact
    const account = await runInOrganizationContext(world.organizationA, () =>
      accounts.findByContactId(asId<ContactId>(guestResult.contactId)),
    );
    expect(account).toBeUndefined();

    // Finding active customer contact by phone does NOT return the provisional contact
    const activeContact = await runInOrganizationContext(world.organizationA, () =>
      contacts.findActiveByPhone(phone),
    );
    expect(activeContact).toBeUndefined();
  });

  it("refuses provisional contact creation without valid guestSessionId", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const fakeSessionId = newId();

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    await expect(
      runInOrganizationContext(world.organizationA, () =>
        useCase.execute({
          organizationId: world.organizationA,
          guestSessionId: fakeSessionId,
          name: "Invalid Guest",
          phoneE164: "+8801712345008",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return error instanceof AppError && error.code === ERROR_CODE.UNAUTHENTICATED;
    });
  });

  it("rejects cross-organization guestSessionId linkage", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    // Session belongs to Org A
    const guestSessionId = await createGuestSession(world.organizationA);

    const useCase = buildProvisionalGuestContactCreator({
      audit: buildAuditRecorder(harness.clock),
      clock: harness.clock,
    });

    // Attempt to link session from Org A into Org B
    await expect(
      runInOrganizationContext(world.organizationB, () =>
        useCase.execute({
          organizationId: world.organizationB,
          guestSessionId,
          name: "Attacker Guest",
          phoneE164: "+8801712345009",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof AppError &&
        (error.code === ERROR_CODE.FORBIDDEN || error.code === ERROR_CODE.UNAUTHENTICATED)
      );
    });
  });
});
