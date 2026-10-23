import {
  ALL_LOCATIONS,
  AUDIT_ACTION,
  CUSTOM_FIELD_TYPE,
  ERROR_CODE,
  SYSTEM_ROLE_KEY,
} from "@banijjik/contracts";
import { CREDIT_ENTRY_TYPE, CREDIT_RULE_KEY } from "@banijjik/contracts/credit";
import type {
  CreditEntry,
  CreditPack,
  MyCreditsResponse,
  UnlockListItem,
  UnlockResponse,
} from "@banijjik/contracts/credit";
import { LISTING_FIELD_TIER } from "@banijjik/contracts/directory";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { asId, newId, type CustomerAccountId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import {
  accountPath,
  adjustPath,
  createApprovedListing,
  customerAccountIdOf,
  disableCreditModule,
  enableCreditForWorld,
  grantCredits,
  ownerOf,
  searchListings,
  unlock,
  type ApprovedListing,
} from "../../../../test-support/credit-world.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
  type SignedInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { models, MongoUnitOfWork } from "../../../../kernel/db/index.js";

import { MongoCreditRepository } from "../index.js";
import { ExpireCreditsUseCase } from "../application/use-cases/expire-credits.use-case.js";
import type { CreditDependencies } from "../application/ports/credit-dependencies.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ templateReader, tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

const LISTING_FIELDS = [
  listingField({
    fieldKey: "age_band",
    fieldType: CUSTOM_FIELD_TYPE.SELECT,
    listingTier: LISTING_FIELD_TIER.PUBLIC,
    isRequired: true,
    options: ["20", "25", "30"],
    sortOrder: 1,
  }),
  listingField({
    fieldKey: "family_note",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    listingTier: LISTING_FIELD_TIER.MEMBERS,
    sortOrder: 2,
  }),
  listingField({
    fieldKey: "guardian_name",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    listingTier: LISTING_FIELD_TIER.UNLOCKED,
    sortOrder: 3,
  }),
  listingField({
    fieldKey: "own_name",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    listingTier: LISTING_FIELD_TIER.PRIVATE,
    sortOrder: 4,
  }),
];

function listingField(input: {
  readonly fieldKey: string;
  readonly fieldType: string;
  readonly listingTier: string;
  readonly isRequired?: boolean;
  readonly options?: readonly string[];
  readonly sortOrder: number;
}) {
  return {
    entityType: "listing",
    fieldKey: input.fieldKey,
    fieldType: input.fieldType,
    label: { bn: input.fieldKey, en: input.fieldKey },
    isRequired: input.isRequired ?? false,
    visibility: { admin: true, storefront: true, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: input.sortOrder,
    listingTier: input.listingTier,
    ...(input.options === undefined ? {} : { options: input.options }),
  };
}

async function addListingFields(world: TwoOrganizations, organizationId: string): Promise<void> {
  for (const field of LISTING_FIELDS) {
    const created = await ownerOf(world, organizationId).call(
      "post",
      `/orgs/${organizationId}/custom-fields`,
      field,
    );
    if (created.status !== 201) {
      throw new Error(`custom field ${field.fieldKey} failed: ${created.status}`);
    }
  }
}

/** Directory and credit on, customer sign-in on, and the listing fields both businesses use. */
async function aCreditWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  await enableCreditForWorld(world);
  await addListingFields(world, world.organizationA);
  await addListingFields(world, world.organizationB);
  return world;
}

interface OwnedListing {
  readonly owner: SignedInCustomer;
  readonly listing: ApprovedListing;
}

/** A new customer account of the organization owns one approved listing. */
async function anApprovedListing(
  world: TwoOrganizations,
  organizationId: string = world.organizationA,
): Promise<OwnedListing> {
  const owner = await signInCustomer(harness, organizationId);
  const listing = await createApprovedListing({
    app: harness.app,
    world,
    organizationId,
    owner,
    customFields: {
      age_band: "25",
      family_note: "joint family",
      guardian_name: "Guardian Name",
      own_name: "private name",
    },
  });
  return { owner, listing };
}

function packsPath(organizationId: string): string {
  return `/orgs/${organizationId}/credit/packs`;
}

function packBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    name: { bn: "দশ ক্রেডিট", en: "Ten credits" },
    credits: 10,
    price: { amount: 25_000, currency: "BDT" },
    validityDays: null,
    sortOrder: 1,
    ...overrides,
  };
}

function dataOf<T>(response: Response): T {
  return response.body.data as T;
}

function patchSettings(
  world: TwoOrganizations,
  organizationId: string,
  items: readonly { readonly settingKey: string; readonly value: unknown }[],
) {
  return ownerOf(world, organizationId).call("patch", `/orgs/${organizationId}/settings`, {
    items,
  });
}

function creditEntriesOf(entries: readonly CreditEntry[], type: string): readonly CreditEntry[] {
  return entries.filter((entry) => entry.type === type);
}

function sumCredits(entries: readonly CreditEntry[]): number {
  return entries.reduce((total, entry) => total + entry.credits, 0);
}

function fieldNamesOf(listing: { readonly customFields: Record<string, unknown> }): string[] {
  return Object.keys(listing.customFields);
}

describe("credit packs", () => {
  it("creates, updates and archives a pack and only shows active packs to customers", async () => {
    const world = await aCreditWorld();
    const organizationId = world.organizationA;

    const created = await world.alice.call("post", packsPath(organizationId), packBody());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const pack = dataOf<CreditPack>(created);
    expect(pack.credits).toBe(10);
    expect(pack.status).toBe("ACTIVE");
    expect(pack.version).toBe(1);
    const storedPack = await harness.connections.tenantShared
      .collection("credit_packs")
      .findOne({ organizationId, creditPackId: pack.creditPackId });
    expect(storedPack?.["createdByUserId"]).toBe(world.alice.userId);
    expect(JSON.stringify(created.body)).not.toContain("organizationId");

    const staffList = await world.alice.call("get", packsPath(organizationId));
    expect(staffList.status).toBe(200);
    expect(dataOf<{ items: readonly CreditPack[]; total: number }>(staffList).total).toBe(1);

    const publicList = await callStorefront(harness.app, {
      method: "get",
      organizationId,
      suffix: "/credit-packs",
    });
    expect(publicList.status).toBe(200);
    expect(dataOf<readonly CreditPack[]>(publicList)).toHaveLength(1);

    const updated = await world.alice.call(
      "patch",
      `${packsPath(organizationId)}/${pack.creditPackId}`,
      {
        ...packBody({ credits: 20 }),
        version: 1,
      },
    );
    expect(updated.status).toBe(200);
    expect(dataOf<CreditPack>(updated).credits).toBe(20);
    expect(dataOf<CreditPack>(updated).version).toBe(2);

    const stale = await world.alice.call(
      "patch",
      `${packsPath(organizationId)}/${pack.creditPackId}`,
      {
        ...packBody({ credits: 30 }),
        version: 1,
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe(ERROR_CODE.CONFLICT);

    const archived = await world.alice.call(
      "post",
      `${packsPath(organizationId)}/${pack.creditPackId}/archive`,
      { version: 2 },
    );
    expect(archived.status).toBe(200);
    expect(dataOf<CreditPack>(archived).status).toBe("ARCHIVED");

    const publicAfter = await callStorefront(harness.app, {
      method: "get",
      organizationId,
      suffix: "/credit-packs",
    });
    expect(dataOf<readonly CreditPack[]>(publicAfter)).toHaveLength(0);

    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ entityId: pack.creditPackId })
      .toArray();
    const actions = audit.map((entry) => entry["action"]);
    expect(actions).toContain(AUDIT_ACTION.CREDIT_PACK_CREATED);
    expect(actions).toContain(AUDIT_ACTION.CREDIT_PACK_UPDATED);
    expect(actions).toContain(AUDIT_ACTION.CREDIT_PACK_ARCHIVED);
  });

  it("lets STAFF read packs but not write them, and refuses a VIEWER the read", async () => {
    const world = await aCreditWorld();
    const organizationId = world.organizationA;
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: ALL_LOCATIONS, roleId: staffRoleId },
    ]);

    const staffRead = await staff.actor.call("get", packsPath(organizationId));
    expect(staffRead.status).toBe(200);
    const staffWrite = await staff.actor.call("post", packsPath(organizationId), packBody());
    expect(staffWrite.status).toBe(403);
    expect(staffWrite.body.error.code).toBe(ERROR_CODE.FORBIDDEN);

    const viewerRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const viewer = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: ALL_LOCATIONS, roleId: viewerRoleId },
    ]);
    const viewerRead = await viewer.actor.call("get", packsPath(organizationId));
    expect(viewerRead.status).toBe(403);
    expect(viewerRead.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
  });
});

describe("credit ledger and unlock", () => {
  it("grants credits, charges one unlock, replays it without a charge and keeps every entry", async () => {
    const world = await aCreditWorld();
    const { owner, listing } = await anApprovedListing(world);
    const buyer = await signInCustomer(harness, world.organizationA);
    const buyerAccountId = customerAccountIdOf(buyer);

    const granted = await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: buyerAccountId,
      credits: 5,
    });
    expect(granted.status, JSON.stringify(granted.body)).toBe(200);
    expect(dataOf<{ balance: number }>(granted).balance).toBe(5);

    const before = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    expect(before.status).toBe(200);
    expect(dataOf<MyCreditsResponse>(before).balance).toBe(5);
    expect(dataOf<MyCreditsResponse>(before).entries).toHaveLength(1);

    const first = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: listing.listingNumber,
    });
    expect(first.status).toBe(200);
    const firstUnlock = dataOf<UnlockResponse>(first);
    expect(firstUnlock.listingId).toBe(listing.listingId);
    expect(firstUnlock.creditsSpent).toBe(1);
    expect(firstUnlock.remainingBalance).toBe(4);

    const entriesAfterFirst = await harness.connections.tenantShared
      .collection("credit_entries")
      .find({ organizationId: world.organizationA, customerAccountId: buyerAccountId })
      .sort({ occurredAt: 1 })
      .toArray();
    expect(entriesAfterFirst).toHaveLength(2);

    const replay = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: listing.listingNumber,
    });
    expect(replay.status).toBe(200);
    const replayed = dataOf<UnlockResponse>(replay);
    expect(replayed.listingUnlockId).toBe(firstUnlock.listingUnlockId);
    expect(replayed.creditsSpent).toBe(0);
    expect(replayed.remainingBalance).toBe(4);

    const entriesAfterReplay = await harness.connections.tenantShared
      .collection("credit_entries")
      .find({ organizationId: world.organizationA, customerAccountId: buyerAccountId })
      .sort({ occurredAt: 1 })
      .toArray();
    expect(entriesAfterReplay).toEqual(entriesAfterFirst);

    const after = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    const account = dataOf<MyCreditsResponse>(after);
    expect(account.balance).toBe(4);
    expect(sumCredits(account.entries)).toBe(4);
    const spends = creditEntriesOf(account.entries, CREDIT_ENTRY_TYPE.SPEND);
    expect(spends).toHaveLength(1);
    expect(spends[0]?.credits).toBe(-1);
    expect(spends[0]?.source.sourceType).toBe("UNLOCK");
    expect(spends[0]?.source.sourceId).toBe(listing.listingId);
    expect(JSON.stringify(account.entries)).not.toContain("_id");

    const ownerAccount = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(owner.session),
    });
    expect(dataOf<MyCreditsResponse>(ownerAccount).balance).toBe(0);
  }, 60_000);

  it("lets exactly three of five parallel unlocks through with a balance of three", async () => {
    const world = await aCreditWorld();
    const listings: ApprovedListing[] = [];
    for (let index = 0; index < 5; index += 1) {
      const owned = await anApprovedListing(world);
      listings.push(owned.listing);
    }
    const buyer = await signInCustomer(harness, world.organizationA);
    const buyerAccountId = customerAccountIdOf(buyer);
    const granted = await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: buyerAccountId,
      credits: 3,
    });
    expect(granted.status).toBe(200);

    const responses = await Promise.all(
      listings.map((listing) =>
        unlock({
          app: harness.app,
          organizationId: world.organizationA,
          customer: buyer,
          listingNumber: listing.listingNumber,
        }),
      ),
    );
    const succeeded = responses.filter((response) => response.status === 200);
    const refused = responses.filter((response) => response.status === 422);
    expect(succeeded).toHaveLength(3);
    expect(refused).toHaveLength(2);
    for (const response of refused) {
      expect(response.body.error.code).toBe(ERROR_CODE.CREDITS_INSUFFICIENT);
    }
    const unlockIds = succeeded.map((response) => dataOf<UnlockResponse>(response).listingUnlockId);
    expect(new Set(unlockIds).size).toBe(3);

    const account = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    const credits = dataOf<MyCreditsResponse>(account);
    expect(credits.balance).toBe(0);
    expect(creditEntriesOf(credits.entries, CREDIT_ENTRY_TYPE.SPEND)).toHaveLength(3);
    expect(sumCredits(credits.entries)).toBe(0);

    const balanceRow = await harness.connections.tenantShared
      .collection("credit_balances")
      .findOne({ organizationId: world.organizationA, customerAccountId: buyerAccountId });
    expect(balanceRow?.["balance"]).toBe(0);
  }, 60_000);

  it("charges once when the same unlock arrives twice in parallel", async () => {
    const world = await aCreditWorld();
    const { listing } = await anApprovedListing(world);
    const buyer = await signInCustomer(harness, world.organizationA);
    const buyerAccountId = customerAccountIdOf(buyer);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: buyerAccountId,
      credits: 1,
    });

    await patchSettings(world, world.organizationA, [
      { settingKey: CREDIT_RULE_KEY.UNLOCKS_PER_DAY, value: 1 },
    ]);
    const responses = await Promise.all([
      unlock({
        app: harness.app,
        organizationId: world.organizationA,
        customer: buyer,
        listingNumber: listing.listingNumber,
        idempotencyKey: newId(),
      }),
      unlock({
        app: harness.app,
        organizationId: world.organizationA,
        customer: buyer,
        listingNumber: listing.listingNumber,
        idempotencyKey: newId(),
      }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const unlocks = responses.map((response) => dataOf<UnlockResponse>(response));
    expect(unlocks[0]?.listingUnlockId).toBe(unlocks[1]?.listingUnlockId);
    expect(unlocks.map((item) => item.creditsSpent).sort()).toEqual([0, 1]);

    const account = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    const credits = dataOf<MyCreditsResponse>(account);
    expect(credits.balance).toBe(0);
    expect(creditEntriesOf(credits.entries, CREDIT_ENTRY_TYPE.SPEND)).toHaveLength(1);
  });

  it("serializes different listings at the daily cap and rolls back refused debits", async () => {
    const world = await aCreditWorld();
    const listings: ApprovedListing[] = [];
    for (let index = 0; index < 4; index += 1) {
      listings.push((await anApprovedListing(world)).listing);
    }
    const buyer = await signInCustomer(harness, world.organizationA);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(buyer),
      credits: 10,
    });
    expect(
      (
        await patchSettings(world, world.organizationA, [
          { settingKey: CREDIT_RULE_KEY.UNLOCKS_PER_DAY, value: 2 },
        ])
      ).status,
    ).toBe(200);
    const responses = await Promise.all(
      listings.map((listing) =>
        unlock({
          app: harness.app,
          organizationId: world.organizationA,
          customer: buyer,
          listingNumber: listing.listingNumber,
        }),
      ),
    );
    expect(responses.filter((response) => response.status === 200)).toHaveLength(2);
    const refused = responses.filter((response) => response.status !== 200);
    expect(refused).toHaveLength(2);
    for (const response of refused) {
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe(ERROR_CODE.UNLOCKS_PER_DAY_EXCEEDED);
    }
    const account = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    const credits = dataOf<MyCreditsResponse>(account);
    expect(credits.balance).toBe(8);
    expect(sumCredits(credits.entries)).toBe(8);
    expect(creditEntriesOf(credits.entries, CREDIT_ENTRY_TYPE.SPEND)).toHaveLength(2);
  }, 60_000);

  it("uses the configured cost and refuses the unlock that exceeds the daily limit", async () => {
    const world = await aCreditWorld();
    const first = await anApprovedListing(world);
    const second = await anApprovedListing(world);
    const buyer = await signInCustomer(harness, world.organizationA);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(buyer),
      credits: 5,
    });

    const patched = await patchSettings(world, world.organizationA, [
      { settingKey: CREDIT_RULE_KEY.UNLOCK_COST, value: 2 },
      { settingKey: CREDIT_RULE_KEY.UNLOCKS_PER_DAY, value: 1 },
    ]);
    expect(patched.status).toBe(200);

    const allowed = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: first.listing.listingNumber,
    });
    expect(allowed.status).toBe(200);
    expect(dataOf<UnlockResponse>(allowed).creditsSpent).toBe(2);
    expect(dataOf<UnlockResponse>(allowed).remainingBalance).toBe(3);

    const limited = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: second.listing.listingNumber,
    });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe(ERROR_CODE.UNLOCKS_PER_DAY_EXCEEDED);

    const account = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    expect(dataOf<MyCreditsResponse>(account).balance).toBe(3);
  });

  it("refuses a customer's own listing without charging", async () => {
    const world = await aCreditWorld();
    const { owner, listing } = await anApprovedListing(world);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(owner),
      credits: 5,
    });

    const response = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: owner,
      listingNumber: listing.listingNumber,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.CANNOT_UNLOCK_OWN_LISTING);

    const account = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(owner.session),
    });
    expect(dataOf<MyCreditsResponse>(account).balance).toBe(5);
  });

  it("answers 404 for a listing that is not approved and for an unknown number", async () => {
    const world = await aCreditWorld();
    await anApprovedListing(world);
    const customer = await signInCustomer(harness, world.organizationA);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(customer),
      credits: 5,
    });

    const draft = await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: asCustomerCookies(customer.session),
      body: { customFields: { age_band: "25" } },
    });
    expect(draft.status).toBe(200);
    const draftNumber = draft.body.data.listingNumber as string;

    const notApproved = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer,
      listingNumber: draftNumber,
    });
    expect(notApproved.status).toBe(404);
    expect(notApproved.body.error.code).toBe(ERROR_CODE.LISTING_NOT_APPROVED);

    const unknown = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer,
      listingNumber: "L-999999",
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("requires a UUID Idempotency-Key and charges nothing without one", async () => {
    const world = await aCreditWorld();
    const { listing } = await anApprovedListing(world);
    const buyer = await signInCustomer(harness, world.organizationA);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(buyer),
      credits: 5,
    });

    const missing = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: listing.listingNumber,
      idempotencyKey: null,
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const invalid = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: listing.listingNumber,
      idempotencyKey: "not-a-uuid",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const account = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/credits",
      cookies: asCustomerCookies(buyer.session),
    });
    expect(dataOf<MyCreditsResponse>(account).balance).toBe(5);
  });
});

describe("unlock projection and privacy", () => {
  it("reveals UNLOCKED fields to the unlocking account only and never lists who unlocked", async () => {
    const world = await aCreditWorld();
    const { owner, listing } = await anApprovedListing(world);
    const buyer = await signInCustomer(harness, world.organizationA);
    const other = await signInCustomer(harness, world.organizationA);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(buyer),
      credits: 5,
    });

    const before = await searchListings(harness.app, world.organizationA, buyer);
    expect(before.status).toBe(200);
    expect(fieldNamesOf(before.body.data.items[0])).not.toContain("guardian_name");

    const unlocked = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: listing.listingNumber,
    });
    expect(unlocked.status).toBe(200);

    const after = await searchListings(harness.app, world.organizationA, buyer);
    expect(fieldNamesOf(after.body.data.items[0])).toContain("guardian_name");
    expect(fieldNamesOf(after.body.data.items[0])).toContain("family_note");
    expect(fieldNamesOf(after.body.data.items[0])).not.toContain("own_name");

    const otherView = await searchListings(harness.app, world.organizationA, other);
    expect(fieldNamesOf(otherView.body.data.items[0])).not.toContain("guardian_name");

    const myUnlocks = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/unlocks",
      cookies: asCustomerCookies(buyer.session),
    });
    expect(myUnlocks.status).toBe(200);
    const unlockItems = dataOf<readonly UnlockListItem[]>(myUnlocks);
    expect(unlockItems).toHaveLength(1);
    expect(unlockItems[0]?.listingNumber).toBe(listing.listingNumber);
    expect(Object.keys(unlockItems[0]?.customFields ?? {})).toContain("guardian_name");
    expect(Object.keys(unlockItems[0]?.customFields ?? {})).not.toContain("own_name");

    const count = await ownerOf(world, world.organizationA).call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listing.listingId}/unlock-count`,
    );
    expect(count.status).toBe(200);
    expect(dataOf<{ listingId: string; unlockCount: number }>(count)).toEqual({
      listingId: listing.listingId,
      unlockCount: 1,
    });
    expect(JSON.stringify(count.body)).not.toContain(customerAccountIdOf(buyer));
    expect(JSON.stringify(count.body)).not.toContain(buyer.phone);
    expect(JSON.stringify(count.body)).not.toContain("customerAccountId");
    expect(JSON.stringify(count.body)).not.toContain(owner.phone);
  }, 60_000);

  it("hides UNLOCKED fields, the count and the tenant API when the credit module is off", async () => {
    const world = await aCreditWorld();
    const { listing } = await anApprovedListing(world);
    const buyer = await signInCustomer(harness, world.organizationA);
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId: customerAccountIdOf(buyer),
      credits: 5,
    });
    await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: listing.listingNumber,
    });

    const visible = await searchListings(harness.app, world.organizationA, buyer);
    expect(fieldNamesOf(visible.body.data.items[0])).toContain("guardian_name");

    const customerAccountId = customerAccountIdOf(buyer);
    const filter = { organizationId: world.organizationA, customerAccountId };
    const database = harness.connections.tenantShared;
    const balanceBefore = await database.collection("credit_balances").findOne(filter);
    const entriesBefore = await database.collection("credit_entries").find(filter).toArray();
    const unlocksBefore = await database.collection("listing_unlocks").find(filter).toArray();
    const other = await anApprovedListing(world);
    await disableCreditModule(world.organizationA);
    const refused = await unlock({
      app: harness.app,
      organizationId: world.organizationA,
      customer: buyer,
      listingNumber: other.listing.listingNumber,
    });
    expect(refused.status).toBe(404);
    for (const suffix of ["/my/credits", "/my/unlocks", "/credit-packs"]) {
      const response = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix,
        cookies: asCustomerCookies(buyer.session),
      });
      expect(response.status).toBe(404);
    }
    expect(await database.collection("credit_balances").findOne(filter)).toEqual(balanceBefore);
    expect(await database.collection("credit_entries").find(filter).toArray()).toEqual(
      entriesBefore,
    );
    expect(await database.collection("listing_unlocks").find(filter).toArray()).toEqual(
      unlocksBefore,
    );

    const hidden = await searchListings(harness.app, world.organizationA, buyer);
    expect(hidden.status).toBe(200);
    expect(fieldNamesOf(hidden.body.data.items[0])).not.toContain("guardian_name");

    const count = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listing.listingId}/unlock-count`,
    );
    expect(count.status).toBe(404);

    const packs = await world.alice.call("get", packsPath(world.organizationA));
    expect(packs.status).toBe(403);
    expect(packs.body.error.code).toBe(ERROR_CODE.MODULE_DISABLED);
  }, 60_000);
});

describe("adjustments and isolation", () => {
  it("bounds the public active pack list at 100", async () => {
    const world = await aCreditWorld();
    const now = new Date();
    await harness.connections.tenantShared.collection("credit_packs").insertMany(
      Array.from({ length: 101 }, (_, sortOrder) => ({
        organizationId: world.organizationA,
        creditPackId: newId(),
        name: { en: "Pack", bn: "প্যাক" },
        credits: 1,
        price: { amount: 100, currency: "BDT" },
        validityDays: null,
        status: "ACTIVE",
        sortOrder,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdByUserId: null,
        updatedByUserId: null,
      })),
    );
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/credit-packs",
    });
    expect(response.status).toBe(200);
    const packs = dataOf<readonly CreditPack[]>(response);
    expect(packs).toHaveLength(100);
    expect(packs[0]?.sortOrder).toBe(0);
    expect(packs[99]?.sortOrder).toBe(99);
  });
  it("reads every purchase past 1000 rows with equal timestamps", async () => {
    const world = await aCreditWorld();
    const customerAccountId = asId<CustomerAccountId>(
      customerAccountIdOf(await signInCustomer(harness, world.organizationA)),
    );
    const occurredAt = new Date("2026-10-01T00:00:00Z");
    const rows = Array.from({ length: 1001 }, () => ({
      organizationId: world.organizationA,
      customerAccountId,
      creditEntryId: newId(),
      type: CREDIT_ENTRY_TYPE.PURCHASE,
      credits: 1,
      occurredAt,
      createdAt: occurredAt,
      expiresOn: new Date("2026-10-02T00:00:00Z"),
      source: { sourceType: "PAYMENT", sourceId: newId() },
      fromPurchaseEntryId: null,
      reason: null,
      createdByUserId: null,
      businessDate: "2026-10-01",
    }));
    await harness.connections.tenantShared.collection("credit_entries").insertMany(rows);
    await withOrganizationContext(world.organizationA, async () => {
      const repository = new MongoCreditRepository();
      const purchases = await repository.listPurchases(customerAccountId);
      expect(purchases).toHaveLength(1001);
      expect(new Set(purchases.map((entry) => entry.creditEntryId)).size).toBe(1001);
      expect(await repository.listExpiringPurchases("2026-10-21")).toHaveLength(1001);
    });
  });

  it("expires once under concurrent real transactions and never reallocates expired credit", async () => {
    const world = await aCreditWorld();
    const buyer = await signInCustomer(harness, world.organizationA);
    const customerAccountId = asId<CustomerAccountId>(customerAccountIdOf(buyer));
    await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId,
      credits: 10,
    });
    await withOrganizationContext(world.organizationA, async () => {
      const credit = new MongoCreditRepository();
      const unitOfWork = new MongoUnitOfWork();
      const purchaseId = newId();
      await unitOfWork.run(async () => {
        await credit.applyDelta({ customerAccountId, delta: 10 });
        await credit.insertEntry({
          creditEntryId: purchaseId,
          customerAccountId,
          type: CREDIT_ENTRY_TYPE.PURCHASE,
          credits: 10,
          expiresOn: "2026-10-02T00:00:00Z",
          source: { sourceType: "PAYMENT", sourceId: newId() },
          fromPurchaseEntryId: null,
          reason: null,
          createdByUserId: null,
          occurredAt: "2026-10-01T00:00:00Z",
          createdAt: "2026-10-01T00:00:00Z",
          businessDate: "2026-10-01",
        });
      });
      const deps = {
        credit,
        unitOfWork,
        clock: { now: () => new Date("2026-10-21T08:00:00Z") },
        events: { publish: async () => undefined },
        timeZone: { read: async () => "Asia/Dhaka" },
      } as unknown as CreditDependencies;
      const results = await Promise.all([
        new ExpireCreditsUseCase(deps).execute(),
        new ExpireCreditsUseCase(deps).execute(),
      ]);
      expect(results.reduce((sum, result) => sum + result.expiredEntries, 0)).toBe(1);
      expect((await credit.getBalance(customerAccountId))?.balance).toBe(10);
      expect(
        (await credit.sumSpendsByPurchase(customerAccountId, [purchaseId])).get(purchaseId),
      ).toBe(10);
      const entries = await credit.listEntries(customerAccountId, { limit: 100, offset: 0 });
      expect(entries.filter((entry) => entry.type === CREDIT_ENTRY_TYPE.EXPIRE)).toHaveLength(1);
      const expiryEntry = entries.find((entry) => entry.type === CREDIT_ENTRY_TYPE.EXPIRE);
      if (!expiryEntry) throw new Error("Expected the committed expiry entry");
      await expect(
        credit.insertEntry({ ...expiryEntry, creditEntryId: newId() }),
      ).rejects.toMatchObject({
        messageKey: "errors.credit_entry_already_exists",
      });
      expect(sumCredits(entries)).toBe(10);
    });
  });
  it("refuses mutations of compiled credit ledger models", async () => {
    const world = await aCreditWorld();
    await withOrganizationContext(world.organizationA, async () => {
      const Model = models({ organizationId: world.organizationA }).get<{ credits: number }>(
        "CreditEntry",
      );
      const filter = { creditEntryId: newId() };
      const error = { messageKey: "errors.append_only_model" };
      await expect(Model.updateOne(filter, { $set: { credits: 100 } })).rejects.toMatchObject(
        error,
      );
      await expect(Model.deleteOne(filter)).rejects.toMatchObject(error);
      await expect(Model.replaceOne(filter, { credits: 100 })).rejects.toMatchObject(error);
    });
  });

  it("rejects zero adjustments without appending a ledger entry", async () => {
    const world = await aCreditWorld();
    const buyer = await signInCustomer(harness, world.organizationA);
    const customerAccountId = asId<CustomerAccountId>(customerAccountIdOf(buyer));
    const response = await grantCredits({
      world,
      organizationId: world.organizationA,
      customerAccountId,
      credits: 0,
    });
    expect(response.status).toBe(400);
    expect(
      await harness.connections.tenantShared
        .collection("credit_entries")
        .countDocuments({ organizationId: world.organizationA, customerAccountId }),
    ).toBe(0);
  });
  it("refuses a MANAGER without an approval token and accepts another MANAGER's token once", async () => {
    const world = await aCreditWorld();
    const organizationId = world.organizationA;
    const buyer = await signInCustomer(harness, organizationId);
    const customerAccountId = asId<CustomerAccountId>(customerAccountIdOf(buyer));

    const managerRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const adjuster = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const approver = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const pin = await approver.actor.call("put", `/orgs/${organizationId}/me/approval-pin`, {
      currentPassword: API_PASSWORD,
      pin: "4321",
    });
    expect(pin.status).toBe(204);

    const refused = await adjuster.actor.call(
      "post",
      adjustPath(organizationId, customerAccountId),
      { credits: 7, reason: "goodwill" },
    );
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe(ERROR_CODE.APPROVAL_REQUIRED);

    const approval = await adjuster.actor.call("post", `/orgs/${organizationId}/approvals`, {
      action: APPROVAL_ACTION.CREDIT_ADJUSTMENT,
      subjectKey: customerAccountId,
      locationId: world.locationA1,
      approverMemberId: approver.memberId,
      pin: "4321",
    });
    expect(approval.status).toBe(200);
    const approvalToken = approval.body.data.approvalToken as string;

    const adjusted = await adjuster.actor.call(
      "post",
      adjustPath(organizationId, customerAccountId),
      { credits: 7, reason: "goodwill", approvalToken },
    );
    expect(adjusted.status).toBe(200);
    expect(dataOf<{ balance: number }>(adjusted).balance).toBe(7);

    const reused = await adjuster.actor.call(
      "post",
      adjustPath(organizationId, customerAccountId),
      { credits: 1, reason: "replay", approvalToken },
    );
    expect(reused.status).toBe(403);
    expect(reused.body.error.code).toBe(ERROR_CODE.APPROVAL_REQUIRED);

    const account = await adjuster.actor.call(
      "get",
      accountPath(organizationId, customerAccountId),
    );
    expect(account.status).toBe(200);
    expect(dataOf<MyCreditsResponse>(account).balance).toBe(7);

    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ entityId: customerAccountId, action: AUDIT_ACTION.CREDIT_ACCOUNT_ADJUSTED })
      .toArray();
    expect(audit).toHaveLength(1);
  }, 60_000);

  it("refuses a STAFF adjust and an adjustment below zero", async () => {
    const world = await aCreditWorld();
    const buyer = await signInCustomer(harness, world.organizationA);
    const customerAccountId = asId<CustomerAccountId>(customerAccountIdOf(buyer));

    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: staffRoleId },
    ]);
    const denied = await staff.actor.call(
      "post",
      adjustPath(world.organizationA, customerAccountId),
      { credits: 5, reason: "not allowed" },
    );
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODE.FORBIDDEN);

    const negative = await ownerOf(world, world.organizationA).call(
      "post",
      adjustPath(world.organizationA, customerAccountId),
      { credits: -1, reason: "below zero" },
    );
    expect(negative.status).toBe(422);
    expect(negative.body.error.code).toBe(ERROR_CODE.CREDITS_INSUFFICIENT);

    const unknown = await ownerOf(world, world.organizationA).call(
      "post",
      adjustPath(world.organizationA, newId()),
      { credits: 1, reason: "nobody" },
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("refuses a customer token of one organization at another and hides cross-org records", async () => {
    const world = await aCreditWorld();
    const customerA = await signInCustomer(harness, world.organizationA);
    const customerB = await signInCustomer(harness, world.organizationB);
    const listingB = await anApprovedListing(world, world.organizationB);

    const wrongSurface = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationB,
      suffix: "/my/credits",
      cookies: asCustomerCookies(customerA.session),
    });
    expect(wrongSurface.status).toBe(401);
    expect(wrongSurface.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);

    const accountOfOtherOrg = await world.alice.call(
      "get",
      accountPath(world.organizationA, customerAccountIdOf(customerB)),
    );
    expect(accountOfOtherOrg.status).toBe(404);
    expect(accountOfOtherOrg.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    const listingOfOtherOrg = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listingB.listing.listingId}/unlock-count`,
    );
    expect(listingOfOtherOrg.status).toBe(404);
    expect(listingOfOtherOrg.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  }, 60_000);
});
