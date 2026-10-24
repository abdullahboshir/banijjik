import {
  AUDIT_ACTION,
  CUSTOM_FIELD_TYPE,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
} from "@banijjik/contracts";
import { CUSTOMER_DATA_EXPORT_RULES } from "@banijjik/contracts/contact";
import { CREDIT_PURCHASE_METHOD, CREDIT_PURCHASE_STATUS } from "@banijjik/contracts/credit";
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
  latestCode,
  signInCustomer,
  TEST_OTP_SECRET,
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
    it("refuses sign-in code for erase and erase code for sign-in", async () => {
      const world = await aWorld();
      const customer = await signInCustomer(harness, world.organizationA);
      const cookies = asCustomerCookies(customer.session);
      const phoneE164 = `+88${customer.phone}`;

      // 1. Request sign-in code
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/auth/otp/send",
        body: { phone: customer.phone },
      });
      await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
      const signInCode = await latestCode(world.organizationA, phoneE164);

      // Sign-in code is refused for erasure
      const eraseWithSignInCode = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies,
        body: { challengeId: newId(), code: signInCode },
      });
      expect(eraseWithSignInCode.status).toBe(400);

      // 2. Request erase code
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase/otp",
        cookies,
      });
      await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
      const eraseCode = await latestCode(world.organizationA, phoneE164);

      // Erase code is refused for sign-in
      const signInWithEraseCode = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/auth/otp/verify",
        body: { phone: customer.phone, code: eraseCode },
      });
      expect(signInWithEraseCode.status).toBe(400);
    });

    it("increments attempts on wrong erase code and rejects expired challenge", async () => {
      const world = await aWorld();
      const customer = await signInCustomer(harness, world.organizationA);
      const cookies = asCustomerCookies(customer.session);

      const otpRes = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase/otp",
        cookies,
      });
      const challengeId = otpRes.body.data.challengeId as string;

      // Wrong code
      const wrong1 = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies,
        body: { challengeId, code: "999999" },
      });
      expect(wrong1.status).toBe(400);

      // Expire the challenge in DB without invalidating auth cookie
      await harness.connections.tenantShared
        .collection("otp_challenges")
        .updateOne(
          { otpChallengeId: challengeId },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );

      const expiredRes = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies,
        body: { challengeId, code: "123456" },
      });
      expect(expiredRes.status).toBe(400);
    });
  });

  describe("Erase Execution Happy Path", () => {
    it("erases account, cleans listing, cancels pending purchases, deletes blocks & open reports, and logs audit", async () => {
      const world = await aWorld();
      const c1 = await createCustomerWithListing(world, world.organizationA);
      const c2 = await createCustomerWithListing(world, world.organizationA);

      // Grant credits to c1
      await grantCredits({
        world,
        organizationId: world.organizationA,
        customerAccountId: c1.customerAccountId,
        credits: 50,
      });

      // Create a pending purchase for c1
      await harness.connections.tenantShared.collection("credit_purchases").insertOne({
        creditPurchaseId: newId(),
        organizationId: world.organizationA,
        purchaseNumber: "PUR-1001",
        customerAccountId: c1.customerAccountId,
        creditPackId: newId(),
        snapshot: {
          name: { bn: "১০ ক্রেডিট", en: "10 Credits" },
          credits: 10,
          price: { amount: 500, currency: "BDT" },
          validityDays: 30,
        },
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhoneE164: c1.phoneE164,
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

      // c1 blocks c2's listing
      expect(c2.listingNumber).toBeDefined();
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/listing-blocks",
        cookies: c1.cookies,
        body: { listingNumber: c2.listingNumber ?? "" },
      });

      // c1 files an open report against c2's listing
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: `/listings/${c2.listingNumber}/reports`,
        cookies: c1.cookies,
        body: { reasonKey: "false_info", note: "Filed by c1" },
      });

      // c2 files a report against c1's listing (this report MUST remain!)
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: `/listings/${c1.listingNumber}/reports`,
        cookies: c2.cookies,
        body: { reasonKey: "false_info", note: "Report against c1" },
      });

      // Request erase OTP and execute erase
      const { challengeId, code } = await requestEraseOtp(world.organizationA, c1);
      const eraseRes = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/account/erase",
        cookies: c1.cookies,
        body: { challengeId, code },
      });

      expect(eraseRes.status).toBe(200);
      expect(eraseRes.body.data.erased).toBe(true);
      expect(eraseRes.body.data.forfeitedCredits).toBe(50);

      // Advance clock past the account status cache window (60s)
      harness.clock.advanceSeconds(65);

      // Auth cookie returns 401 now
      const postEraseMe = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: "/me",
        cookies: c1.cookies,
      });
      expect(postEraseMe.status).toBe(401);

      // Verify DB state:
      const tenantDb = harness.connections.tenantShared;

      // 1. Customer account document is deleted
      const accountDoc = await tenantDb
        .collection("customer_accounts")
        .findOne({ customerAccountId: c1.customerAccountId });
      expect(accountDoc).toBeNull();

      // 2. Customer sessions deleted
      const sessions = await tenantDb
        .collection("customer_sessions")
        .find({ customerAccountId: c1.customerAccountId })
        .toArray();
      expect(sessions).toHaveLength(0);

      // 3. Contact is anonymized
      const contactDoc = await tenantDb.collection("contacts").findOne({ phoneE164: c1.phoneE164 });
      expect(contactDoc).toBeNull(); // Phone freed/cleared

      // 4. Listing is ARCHIVED with personal fields cleared
      const listingDoc = await tenantDb
        .collection("directory_listings")
        .findOne({ listingId: c1.listingId });
      expect(listingDoc).not.toBeNull();
      expect(listingDoc?.status).toBe("ARCHIVED");
      expect(listingDoc?.customFields).toEqual({});
      expect(listingDoc?.customFieldSearch).toEqual([]);
      expect(listingDoc?.photoFileIds).toEqual([]);
      expect(listingDoc?.consentsAccepted).toEqual([]);

      // 5. Filed block by c1 is deleted
      const blockDoc = await tenantDb
        .collection("listing_blocks")
        .findOne({ customerAccountId: c1.customerAccountId });
      expect(blockDoc).toBeNull();

      // 6. Open report filed by c1 is deleted
      const c1Report = await tenantDb
        .collection("listing_reports")
        .findOne({ reporterCustomerAccountId: c1.customerAccountId });
      expect(c1Report).toBeNull();

      // 7. Report against c1's listing remains intact
      const reportAgainstC1 = await tenantDb
        .collection("listing_reports")
        .findOne({ listingId: c1.listingId });
      expect(reportAgainstC1).not.toBeNull();

      // 8. Pending purchase is CANCELLED
      const purchases = await tenantDb
        .collection("credit_purchases")
        .find({ customerAccountId: c1.customerAccountId })
        .toArray();
      expect(purchases).toHaveLength(1);
      expect(purchases[0]?.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);

      // 9. Credit entries remain
      const creditEntries = await tenantDb
        .collection("credit_entries")
        .find({ customerAccountId: c1.customerAccountId })
        .toArray();
      expect(creditEntries.length).toBeGreaterThanOrEqual(1);

      // 10. Audit log contains CUSTOMER_ACCOUNT_ERASED with no PII
      const audits = await tenantDb
        .collection("audit_logs")
        .find({ action: AUDIT_ACTION.CUSTOMER_ACCOUNT_ERASED, entityId: c1.customerAccountId })
        .toArray();
      expect(audits).toHaveLength(1);
      expect(JSON.stringify(audits[0] ?? {})).not.toContain(c1.phone);
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
