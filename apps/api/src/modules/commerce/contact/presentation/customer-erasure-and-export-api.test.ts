import {
  AUDIT_ACTION,
  CUSTOM_FIELD_TYPE,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
} from "@banijjik/contracts";
import {
  CUSTOMER_DATA_EXPORT_RULES,
  CONTACT_EVENT_TYPE,
  CUSTOMER_DATA_EXPORT_MAX_ROWS,
  CUSTOMER_OTP_PURPOSE,
} from "@banijjik/contracts/contact";
import {
  CREDIT_ENTRY_TYPE,
  CREDIT_PURCHASE_METHOD,
  CREDIT_PURCHASE_STATUS,
  CREDIT_SOURCE_TYPE,
} from "@banijjik/contracts/credit";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enableCreditForWorld, grantCredits } from "../../../../test-support/credit-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import {
  asCustomerCookies,
  callStorefront,
  deliverPendingOtpSms,
  enableCustomerLogin,
  freshPhone,
  latestCode,
  readChallenge,
  readInbox,
  signInCustomer,
  TEST_OTP_SECRET,
  type SignedInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { writeModuleOverride } from "../../../../test-support/entitlement-world.js";
import { buildAuditRecorder } from "../../../core/audit/index.js";
import { registerDirectoryEventHandlers } from "../../directory/index.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ templateReader, tenantRouters: [] });
  registerDirectoryEventHandlers({
    clock: harness.clock,
    audit: buildAuditRecorder(harness.clock),
  });
});

afterAll(async () => {
  await harness.dispose();
});

const DIRECTORY_BLOCK = {
  sections: [{ sectionKey: "basics", label: { bn: "মূল", en: "Basics" } }],
  consents: [{ consentKey: "truthful", text: { bn: "সত্য", en: "Truthful" } }],
  rejectionReasons: [
    { reasonKey: "unclear", label: { bn: "অস্পষ্ট", en: "Unclear" }, isFinal: false },
  ],
  reportReasons: [{ reasonKey: "false_info", label: { bn: "মিথ্যা", en: "False info" } }],
  listingNumberPrefix: "BD",
};

async function seedDirectoryBlock(organizationId: string): Promise<void> {
  const org = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  if (org === null) throw new Error("organization missing");
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey: org["industryTemplateKey"] as string },
      { $set: { "configuration.directory": DIRECTORY_BLOCK }, $inc: { version: 1 } },
    );
}

async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  await enableCreditForWorld(world);
  await seedDirectoryBlock(world.organizationA);
  await seedDirectoryBlock(world.organizationB);

  for (const owner of [
    { staff: world.alice, organizationId: world.organizationA },
    { staff: world.bob, organizationId: world.organizationB },
  ]) {
    await owner.staff.call("post", `/orgs/${owner.organizationId}/custom-fields`, {
      entityType: "listing",
      fieldKey: "age_band",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      label: { bn: "বয়স", en: "Age band" },
      isRequired: true,
      visibility: { admin: true, storefront: true, bot: false },
      botAsk: false,
      isSearchable: false,
      isSensitive: false,
      sortOrder: 1,
      listingTier: "PUBLIC",
    });
  }
  return world;
}

interface FullCustomer {
  readonly customerAccountId: string;
  readonly phone: string;
  readonly phoneE164: string;
  readonly cookies: Record<string, string>;
  readonly listingId?: string;
  readonly listingNumber?: string;
}

async function createCustomerWithListing(
  world: TwoOrganizations,
  organizationId: string,
): Promise<FullCustomer> {
  const customer = await signInCustomer(harness, organizationId);
  const cookies = asCustomerCookies(customer.session);
  const customerAccountId = customer.verifyResponse.body.data.customerAccountId as string;
  const phone = customer.phone;
  const phoneE164 = `+88${phone}`;

  // Update profile
  await callStorefront(harness.app, {
    method: "put",
    organizationId,
    suffix: "/my/profile",
    cookies,
    body: { name: "Test User", email: "user@example.com" },
  });

  // Create listing
  const draft = await callStorefront(harness.app, {
    method: "put",
    organizationId,
    suffix: "/my/listing",
    cookies,
    body: {
      customFields: { age_band: "28" },
    },
  });
  if (draft.status !== 200) throw new Error(`draft failed: ${draft.status}`);
  const listingId = draft.body.data.listingId as string;

  const submitted = await callStorefront(harness.app, {
    method: "post",
    organizationId,
    suffix: "/my/listing/submit",
    cookies,
    body: { consents: [{ consentKey: "truthful" }] },
  });
  if (submitted.status !== 200) throw new Error(`submit failed: ${submitted.status}`);

  const staff = organizationId === world.organizationA ? world.alice : world.bob;
  const approved = await staff.call(
    "post",
    `/orgs/${organizationId}/directory/listings/${listingId}/approve`,
    { version: submitted.body.data.version as number },
  );
  if (approved.status !== 200) throw new Error(`approve failed: ${approved.status}`);

  return {
    customerAccountId,
    phone,
    phoneE164,
    cookies,
    listingId,
    listingNumber: approved.body.data.listingNumber as string,
  };
}

function fullCustomerOf(customer: SignedInCustomer): FullCustomer {
  return {
    customerAccountId: customer.verifyResponse.body.data.customerAccountId as string,
    phone: customer.phone,
    phoneE164: `+88${customer.phone}`,
    cookies: asCustomerCookies(customer.session),
  };
}

async function requestEraseOtp(
  organizationId: string,
  customer: FullCustomer,
): Promise<{ challengeId: string; code: string }> {
  const otpRes = await callStorefront(harness.app, {
    method: "post",
    organizationId,
    suffix: "/my/account/erase/otp",
    cookies: customer.cookies,
  });
  if (otpRes.status !== 200 && otpRes.status !== 202) {
    throw new Error(`erase otp failed: ${otpRes.status}`);
  }
  const challengeId = otpRes.body.data.challengeId as string;
  await deliverPendingOtpSms(harness.connections, organizationId, TEST_OTP_SECRET);
  const code = await latestCode(organizationId, customer.phoneE164);
  return { challengeId, code };
}

describe("Customer Erasure & Data Export API (M.7 A2)", () => {
  describe("Erase Code & Challenge Validation", () => {
    it("refuses a sign-in code for erase and an erase code for sign-in", async () => {
      const world = await aWorld();
      const customer = await signInCustomer(harness, world.organizationA);
      const full = fullCustomerOf(customer);
      const { cookies, phoneE164 } = full;

      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/auth/otp/send",
        body: { phone: customer.phone },
      });
      await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
      const signInCode = await latestCode(world.organizationA, phoneE164);
      const signInChallenge = await readChallenge(world.organizationA, phoneE164);
      expect(signInChallenge?.purpose).toBe(CUSTOMER_OTP_PURPOSE.SIGN_IN);

      const eraseWithSignInCode = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies,
        body: { challengeId: signInChallenge?.otpChallengeId, code: signInCode },
      });
      expect(eraseWithSignInCode.status).toBe(400);

      const stillSignIn = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/auth/otp/verify",
        body: { phone: customer.phone, code: signInCode },
      });
      expect(stillSignIn.status).toBe(200);

      const { challengeId, code } = await requestEraseOtp(world.organizationA, full);
      const signInWithEraseCode = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/auth/otp/verify",
        body: { phone: customer.phone, code },
      });
      expect(signInWithEraseCode.status).toBe(400);
      const untouched = await readChallenge(world.organizationA, phoneE164);
      expect(untouched?.otpChallengeId).toBe(challengeId);
      expect(untouched?.attempts).toBe(0);

      const erased = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies,
        body: { challengeId, code },
      });
      expect(erased.status).toBe(200);
    });

    it("counts a wrong erase code as an attempt and keeps the right code usable", async () => {
      const world = await aWorld();
      const full = fullCustomerOf(await signInCustomer(harness, world.organizationA));
      const { challengeId, code } = await requestEraseOtp(world.organizationA, full);

      const wrong = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies: full.cookies,
        body: { challengeId, code: code === "000000" ? "111111" : "000000" },
      });
      expect(wrong.status).toBe(400);
      const afterWrong = await readChallenge(world.organizationA, full.phoneE164);
      expect(afterWrong?.attempts).toBe(1);
      expect(afterWrong?.consumedAt).toBeUndefined();

      const right = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies: full.cookies,
        body: { challengeId, code },
      });
      expect(right.status).toBe(200);
    });

    it("refuses an expired erase challenge and a used one", async () => {
      const world = await aWorld();
      const full = fullCustomerOf(await signInCustomer(harness, world.organizationA));
      const challenges = harness.connections.tenantShared.collection("otp_challenges");

      const expired = await requestEraseOtp(world.organizationA, full);
      await challenges.updateOne(
        { otpChallengeId: expired.challengeId },
        { $set: { expiresAt: new Date(harness.clock.now().getTime() - 1000) } },
      );
      const expiredResponse = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies: full.cookies,
        body: expired,
      });
      expect(expiredResponse.status).toBe(400);

      const used = await requestEraseOtp(world.organizationA, full);
      await challenges.updateOne(
        { otpChallengeId: used.challengeId },
        { $set: { consumedAt: new Date() } },
      );
      const usedResponse = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies: full.cookies,
        body: used,
      });
      expect(usedResponse.status).toBe(400);
      const account = await harness.connections.tenantShared
        .collection("customer_accounts")
        .findOne({ customerAccountId: full.customerAccountId });
      expect(account).not.toBeNull();
    });

    it("sends the erase code only to the account's own phone and ignores a body", async () => {
      const world = await aWorld();
      const full = fullCustomerOf(await signInCustomer(harness, world.organizationA));
      const otherPhone = freshPhone();

      const sent = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase/otp",
        cookies: full.cookies,
        body: { phone: otherPhone },
      });
      expect(sent.status).toBe(200);
      await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);

      const challenge = await readChallenge(world.organizationA, full.phoneE164);
      expect(challenge?.otpChallengeId).toBe(sent.body.data.challengeId);
      expect(challenge?.purpose).toBe(CUSTOMER_OTP_PURPOSE.ERASE_ACCOUNT);
      const otherInbox = await readInbox(world.organizationA, `+88${otherPhone}`);
      expect(otherInbox).toHaveLength(0);
      const ownInbox = await readInbox(world.organizationA, full.phoneE164);
      expect(ownInbox.at(-1)?.text).toContain("মুছে");
    });
  });

  describe("Erase Execution Happy Path", () => {
    interface ErasedWorld {
      readonly world: TwoOrganizations;
      readonly erased: FullCustomer;
      readonly other: FullCustomer;
      readonly contactId: string;
      readonly response: { status: number; body: { data: Record<string, unknown> } };
      readonly afterEraseMe: { status: number };
    }
    let scenario: ErasedWorld;

    async function seedPendingPurchase(
      organizationId: string,
      customer: FullCustomer,
    ): Promise<void> {
      await harness.connections.tenantShared.collection("credit_purchases").insertOne({
        creditPurchaseId: newId(),
        organizationId,
        purchaseNumber: "PUR-1001",
        customerAccountId: customer.customerAccountId,
        creditPackId: newId(),
        snapshot: {
          name: { bn: "১০ ক্রেডিট", en: "10 Credits" },
          credits: 10,
          price: { amount: 500, currency: "BDT" },
          validityDays: 30,
        },
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhoneE164: customer.phoneE164,
        transactionReference: "TRX12345678",
        status: CREDIT_PURCHASE_STATUS.PENDING,
        submittedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByUserId: null,
        updatedByUserId: null,
      });
    }

    async function postStorefront(
      organizationId: string,
      customer: FullCustomer,
      suffix: string,
      body: Record<string, unknown>,
    ): Promise<void> {
      await callStorefront(harness.app, {
        method: "post",
        organizationId,
        suffix,
        cookies: customer.cookies,
        body,
      });
    }

    beforeAll(async () => {
      const world = await aWorld();
      const organizationId = world.organizationA;
      const erased = await createCustomerWithListing(world, organizationId);
      const other = await createCustomerWithListing(world, organizationId);
      await grantCredits({
        world,
        organizationId,
        customerAccountId: erased.customerAccountId,
        credits: 50,
      });
      await seedPendingPurchase(organizationId, erased);
      await postStorefront(organizationId, erased, "/my/listing-blocks", {
        listingNumber: other.listingNumber ?? "",
      });
      await postStorefront(organizationId, erased, `/listings/${other.listingNumber}/reports`, {
        reasonKey: "false_info",
        note: "Filed by the erased account",
      });
      await postStorefront(organizationId, other, `/listings/${erased.listingNumber}/reports`, {
        reasonKey: "false_info",
        note: "Report against the erased listing",
      });
      const contact = await harness.connections.tenantShared
        .collection("contacts")
        .findOne({ phoneE164: erased.phoneE164 });

      const { challengeId, code } = await requestEraseOtp(organizationId, erased);
      const response = await callStorefront(harness.app, {
        method: "post",
        organizationId,
        suffix: "/my/account/erase",
        cookies: erased.cookies,
        body: { challengeId, code },
      });
      // The customer-status cache lasts 60 seconds; the old cookie must be refused after that.
      harness.clock.advanceSeconds(65);
      const afterEraseMe = await callStorefront(harness.app, {
        method: "get",
        organizationId,
        suffix: "/me",
        cookies: erased.cookies,
      });
      scenario = {
        world,
        erased,
        other,
        contactId: String(contact?.["contactId"]),
        response,
        afterEraseMe,
      };
    });

    it("answers 200 with the forfeited balance and refuses the old cookie afterwards", () => {
      expect(scenario.response.status).toBe(200);
      expect(scenario.response.body.data["erased"]).toBe(true);
      expect(scenario.response.body.data["forfeitedCredits"]).toBe(50);
      expect(scenario.afterEraseMe.status).toBe(401);
    });

    it("deletes the account and its sessions and anonymizes the contact", async () => {
      const tenantDb = harness.connections.tenantShared;
      const accountId = scenario.erased.customerAccountId;
      expect(
        await tenantDb.collection("customer_accounts").findOne({ customerAccountId: accountId }),
      ).toBeNull();
      expect(
        await tenantDb
          .collection("customer_sessions")
          .find({ customerAccountId: accountId })
          .toArray(),
      ).toHaveLength(0);

      const contact = await tenantDb
        .collection("contacts")
        .findOne({ contactId: scenario.contactId });
      expect(contact?.["anonymizedAt"]).toBeInstanceOf(Date);
      expect(contact?.["name"]).toBeUndefined();
      expect(contact?.["phoneE164"]).toBeUndefined();
      expect(contact?.["email"]).toBeUndefined();
    });

    it("archives the listing with its personal data cleared", async () => {
      const listing = await harness.connections.tenantShared
        .collection("directory_listings")
        .findOne({ listingId: scenario.erased.listingId });
      expect(listing?.["status"]).toBe("ARCHIVED");
      expect(listing?.["customFields"]).toEqual({});
      expect(listing?.["customFieldSearch"]).toEqual([]);
      expect(listing?.["photoFileIds"]).toEqual([]);
      expect(listing?.["consentsAccepted"]).toEqual([]);
    });

    it("deletes the blocks and open reports it filed and keeps the reports against its listing", async () => {
      const tenantDb = harness.connections.tenantShared;
      const accountId = scenario.erased.customerAccountId;
      expect(
        await tenantDb.collection("listing_blocks").findOne({ customerAccountId: accountId }),
      ).toBeNull();
      expect(
        await tenantDb
          .collection("listing_reports")
          .findOne({ reporterCustomerAccountId: accountId }),
      ).toBeNull();
      expect(
        await tenantDb
          .collection("listing_reports")
          .findOne({ listingId: scenario.erased.listingId }),
      ).not.toBeNull();
    });

    it("cancels the pending purchase and keeps the credit entries", async () => {
      const tenantDb = harness.connections.tenantShared;
      const accountId = scenario.erased.customerAccountId;
      const purchases = await tenantDb
        .collection("credit_purchases")
        .find({ customerAccountId: accountId })
        .toArray();
      expect(purchases).toHaveLength(1);
      expect(purchases[0]?.["status"]).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
      const entries = await tenantDb
        .collection("credit_entries")
        .find({ customerAccountId: accountId })
        .toArray();
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it("writes one audit row and one event with ids only, no phone or name", async () => {
      const accountId = scenario.erased.customerAccountId;
      const audits = await harness.connections.tenantShared
        .collection("audit_logs")
        .find({ action: AUDIT_ACTION.CUSTOMER_ACCOUNT_ERASED, entityId: accountId })
        .toArray();
      expect(audits).toHaveLength(1);
      const events = await harness.connections.platform
        .collection("outbox_events")
        .find({
          organizationId: scenario.world.organizationA,
          type: CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_ERASED,
        })
        .toArray();
      expect(events).toHaveLength(1);
      expect(JSON.stringify(events[0]?.["payload"])).toContain(accountId);
      for (const row of [audits[0], events[0]]) {
        const json = JSON.stringify(row ?? {});
        expect(json).not.toContain(scenario.erased.phone);
        expect(json).not.toContain("Test User");
      }
    });
  });

  describe("Personal Data Export", () => {
    it("exports profile, listing, directory activity and credit sections without _id or secrets", async () => {
      const world = await aWorld();
      const customer = await createCustomerWithListing(world, world.organizationA);

      await grantCredits({
        world,
        organizationId: world.organizationA,
        customerAccountId: customer.customerAccountId,
        credits: 25,
      });

      const exportRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies: customer.cookies,
      });

      expect(exportRes.status).toBe(200);
      const data = exportRes.body.data;

      // Account & contact info
      expect(data.account.customerAccountId).toBe(customer.customerAccountId);
      expect(data.contact.phoneE164).toBe(customer.phoneE164);

      // Sections
      const listingSection = data.sections.LISTING;
      expect(listingSection).toBeDefined();
      expect(listingSection.listing).not.toBeNull();
      expect(listingSection.truncated).toBe(false);

      const activitySection = data.sections.DIRECTORY_ACTIVITY;
      expect(activitySection).toBeDefined();
      expect(activitySection.truncated).toBe(false);

      const creditSection = data.sections.CREDIT;
      expect(creditSection).toBeDefined();
      expect(creditSection.balance).toBe(25);
      expect(creditSection.entries.length).toBeGreaterThanOrEqual(1);

      // Verify no Mongo _id in response
      const rawJson = JSON.stringify(data);
      expect(rawJson).not.toContain('"_id"');
      expect(rawJson).not.toContain("codeHash");
      expect(rawJson).not.toContain("passwordHash");
    });

    it("cuts a list at the row cap and flags it truncated", async () => {
      const world = await aWorld();
      const customer = fullCustomerOf(await signInCustomer(harness, world.organizationA));
      const now = new Date();
      const blocks = Array.from({ length: CUSTOMER_DATA_EXPORT_MAX_ROWS + 1 }, () => ({
        organizationId: world.organizationA,
        listingBlockId: newId(),
        customerAccountId: customer.customerAccountId,
        listingId: newId(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdByUserId: null,
        updatedByUserId: null,
      }));
      await harness.connections.tenantShared.collection("listing_blocks").insertMany(blocks);

      const exportRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies: customer.cookies,
      });

      expect(exportRes.status).toBe(200);
      const activity = exportRes.body.data.sections.DIRECTORY_ACTIVITY;
      expect(activity.blocks).toHaveLength(CUSTOMER_DATA_EXPORT_MAX_ROWS);
      expect(activity.blocksTruncated).toBe(true);
      expect(activity.reportsTruncated).toBe(false);
      expect(activity.truncated).toBe(true);
      expect(exportRes.body.data.sections.LISTING.truncated).toBe(false);
    });

    it("cuts the credit entries at the row cap and flags the section truncated", async () => {
      const world = await aWorld();
      const customer = fullCustomerOf(await signInCustomer(harness, world.organizationA));
      const now = new Date();
      const entries = Array.from(
        { length: CUSTOMER_DATA_EXPORT_MAX_ROWS + 1 },
        (_unused, index) => ({
          creditEntryId: newId(),
          organizationId: world.organizationA,
          customerAccountId: customer.customerAccountId,
          type: CREDIT_ENTRY_TYPE.ADJUST,
          credits: 1,
          expiresOn: null,
          source: { sourceType: CREDIT_SOURCE_TYPE.ADJUSTMENT, sourceId: newId() },
          fromPurchaseEntryId: null,
          reason: null,
          createdByUserId: null,
          occurredAt: new Date(now.getTime() - index),
          businessDate: "2026-10-24",
          createdAt: now,
        }),
      );
      await harness.connections.tenantShared.collection("credit_entries").insertMany(entries);

      const exportRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies: customer.cookies,
      });

      expect(exportRes.status).toBe(200);
      const credit = exportRes.body.data.sections.CREDIT;
      expect(credit.entries).toHaveLength(CUSTOMER_DATA_EXPORT_MAX_ROWS);
      expect(credit.entriesTruncated).toBe(true);
      expect(credit.truncated).toBe(true);
      expect(credit.unlocksTruncated).toBe(false);
    });

    it("exports only the contact fields visible on the storefront", async () => {
      const world = await aWorld();
      const customer = fullCustomerOf(await signInCustomer(harness, world.organizationA));
      for (const [fieldKey, storefront] of [
        ["shown_note", true],
        ["staff_note", false],
      ] as const) {
        const created = await world.alice.call(
          "post",
          `/orgs/${world.organizationA}/custom-fields`,
          {
            entityType: "contact",
            fieldKey,
            fieldType: CUSTOM_FIELD_TYPE.TEXT,
            label: { bn: "নোট", en: "Note" },
            isRequired: false,
            visibility: { admin: true, storefront, bot: false },
            botAsk: false,
            isSearchable: false,
            isSensitive: false,
            sortOrder: 1,
          },
        );
        expect(created.status).toBe(201);
      }
      await harness.connections.tenantShared.collection("contacts").updateOne(
        { phoneE164: customer.phoneE164 },
        {
          $set: {
            customFields: {
              shown_note: "visible",
              staff_note: "internal",
              ghost_key: "no definition",
            },
          },
        },
      );

      const exportRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies: customer.cookies,
      });

      expect(exportRes.status).toBe(200);
      expect(exportRes.body.data.contact.customFields).toEqual({ shown_note: "visible" });
    });

    it("never shows another account's blocks, reports or phone", async () => {
      const world = await aWorld();
      const owner = await createCustomerWithListing(world, world.organizationA);
      const other = await createCustomerWithListing(world, world.organizationA);
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/listing-blocks",
        cookies: other.cookies,
        body: { listingNumber: owner.listingNumber ?? "" },
      });
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: `/listings/${owner.listingNumber}/reports`,
        cookies: other.cookies,
        body: { reasonKey: "false_info", note: "Filed by the other account" },
      });

      const exportRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies: owner.cookies,
      });

      expect(exportRes.status).toBe(200);
      const activity = exportRes.body.data.sections.DIRECTORY_ACTIVITY;
      expect(activity.blocks).toHaveLength(0);
      expect(activity.reports).toHaveLength(0);
      const rawJson = JSON.stringify(exportRes.body.data);
      expect(rawJson).not.toContain(other.customerAccountId);
      expect(rawJson).not.toContain(other.phoneE164);
      expect(rawJson).not.toContain("Filed by the other account");
    });

    it("enforces maxExportsPerDay rate limit (4th export returns 429)", async () => {
      const world = await aWorld();
      const customer = await signInCustomer(harness, world.organizationA);
      const cookies = asCustomerCookies(customer.session);

      for (let i = 0; i < CUSTOMER_DATA_EXPORT_RULES.maxExportsPerDay; i++) {
        const res = await callStorefront(harness.app, {
          method: "get",
          organizationId: world.organizationA,
          suffix: "/my/data-export",
          cookies,
        });
        expect(res.status).toBe(200);
      }

      // 4th call within same window returns 429
      const fourthRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies,
      });
      expect(fourthRes.status).toBe(429);
    });
  });

  describe("Module-Off Resilience & Cross-Org Isolation", () => {
    it("runs erasure when directory is off and exports credits when credit is off", async () => {
      const world = await aWorld();
      const c = await createCustomerWithListing(world, world.organizationA);

      await grantCredits({
        world,
        organizationId: world.organizationA,
        customerAccountId: c.customerAccountId,
        credits: 15,
      });

      // Disable credit module for organizationA
      await writeModuleOverride({
        organizationId: world.organizationA,
        moduleKey: MODULE_KEY.CREDIT,
        effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
      });

      // Data export still exports credit section
      const exportRes = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
        cookies: c.cookies,
      });
      expect(exportRes.status).toBe(200);
      const creditSection = exportRes.body.data.sections.CREDIT;
      expect(creditSection).toBeDefined();
      expect(creditSection.balance).toBe(15);

      // Disable directory module for organizationA
      await writeModuleOverride({
        organizationId: world.organizationA,
        moduleKey: MODULE_KEY.DIRECTORY,
        effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
      });

      // Erasure still archives the listing
      const { challengeId, code } = await requestEraseOtp(world.organizationA, c);
      const eraseRes = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies: c.cookies,
        body: { challengeId, code },
      });
      expect(eraseRes.status).toBe(200);

      const listing = await harness.connections.tenantShared
        .collection("directory_listings")
        .findOne({ listingId: c.listingId });
      expect(listing?.status).toBe("ARCHIVED");
    });

    it("rejects unauthenticated requests with 401 and cross-org access with 401", async () => {
      const world = await aWorld();
      const cA = await signInCustomer(harness, world.organizationA);
      const cookiesA = asCustomerCookies(cA.session);

      // Unauthenticated
      const unauthExport = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/my/data-export",
      });
      expect(unauthExport.status).toBe(401);

      // Cross-org: Org A token used against Org B
      const crossOrgExport = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationB,
        suffix: "/my/data-export",
        cookies: cookiesA,
      });
      expect(crossOrgExport.status).toBe(401);
    });
  });
});
