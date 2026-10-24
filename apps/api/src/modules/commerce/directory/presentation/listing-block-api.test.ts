import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { DIRECTORY_SAFETY_RULES } from "@banijjik/contracts/directory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enableDirectoryForWorld } from "../../../../test-support/directory-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { buildAuditRecorder } from "../../../core/audit/index.js";
import { registerDirectoryEventHandlers } from "../index.js";
import { newId } from "@banijjik/ids";

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

async function aDirectoryWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  await enableDirectoryForWorld(world);
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

interface ListingOwner {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: string;
  readonly ownerCookies: Record<string, string>;
}

async function approvedListing(
  world: TwoOrganizations,
  organizationId: string,
): Promise<ListingOwner> {
  const customer = await signInCustomer(harness, organizationId);
  const cookies = asCustomerCookies(customer.session);
  const draft = await callStorefront(harness.app, {
    method: "put",
    organizationId,
    suffix: "/my/listing",
    cookies,
    body: { customFields: { age_band: "25" } },
  });
  if (draft.status !== 200) throw new Error(`draft failed: ${JSON.stringify(draft.body)}`);
  const listingId = draft.body.data.listingId as string;
  const submitted = await callStorefront(harness.app, {
    method: "post",
    organizationId,
    suffix: "/my/listing/submit",
    cookies,
    body: { consents: [{ consentKey: "truthful" }] },
  });
  if (submitted.status !== 200) throw new Error(`submit failed: ${JSON.stringify(submitted.body)}`);
  const staff = organizationId === world.organizationA ? world.alice : world.bob;
  const approved = await staff.call(
    "post",
    `/orgs/${organizationId}/directory/listings/${listingId}/approve`,
    { version: submitted.body.data.version as number },
  );
  if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved.body)}`);
  return {
    listingId,
    listingNumber: approved.body.data.listingNumber as string,
    ownerCustomerAccountId: customer.verifyResponse.body.data.customerAccountId as string,
    ownerCookies: cookies,
  };
}

describe("Listing Block API (M.7 A2)", () => {
  it("blocks a listing, is idempotent on duplicate, and lists blocks", async () => {
    const world = await aDirectoryWorld();
    const l1 = await approvedListing(world, world.organizationA);
    const viewer = await signInCustomer(harness, world.organizationA);
    const viewerCookies = asCustomerCookies(viewer.session);

    // 1. Block listing
    const blockRes = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks",
      cookies: viewerCookies,
      body: { listingNumber: l1.listingNumber },
    });
    expect(blockRes.status).toBe(200);
    expect(blockRes.body.data.listingNumber).toBe(l1.listingNumber);
    expect(blockRes.body.data.listingId).toBe(l1.listingId);
    const firstBlockId = blockRes.body.data.listingBlockId;

    // 2. Duplicate block is idempotent (returns 200 with same block row)
    const dupRes = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks",
      cookies: viewerCookies,
      body: { listingNumber: l1.listingNumber },
    });
    expect(dupRes.status).toBe(200);
    expect(dupRes.body.data.listingBlockId).toBe(firstBlockId);

    // 3. List my listing blocks
    const listRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks?page=1&limit=20",
      cookies: viewerCookies,
    });
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].listingNumber).toBe(l1.listingNumber);

    // 4. Unblock
    const unblockRes = await callStorefront(harness.app, {
      method: "delete",
      organizationId: world.organizationA,
      suffix: `/my/listing-blocks/${l1.listingNumber}`,
      cookies: viewerCookies,
    });
    expect(unblockRes.status).toBe(204);

    // 5. Unblock idempotent
    const unblockDup = await callStorefront(harness.app, {
      method: "delete",
      organizationId: world.organizationA,
      suffix: `/my/listing-blocks/${l1.listingNumber}`,
      cookies: viewerCookies,
    });
    expect(unblockDup.status).toBe(204);

    // 6. List is now empty
    const listAfter = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks",
      cookies: viewerCookies,
    });
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.data.items).toHaveLength(0);
  });

  it("lists blocks newest first, one page at a time", async () => {
    const world = await aDirectoryWorld();
    const first = await approvedListing(world, world.organizationA);
    const second = await approvedListing(world, world.organizationA);
    const viewer = await signInCustomer(harness, world.organizationA);
    const viewerCookies = asCustomerCookies(viewer.session);
    for (const listing of [first, second]) {
      await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/my/listing-blocks",
        cookies: viewerCookies,
        body: { listingNumber: listing.listingNumber },
      });
      harness.clock.advanceSeconds(1);
    }

    const pageOne = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks?page=1&limit=1",
      cookies: viewerCookies,
    });
    const pageTwo = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks?page=2&limit=1",
      cookies: viewerCookies,
    });

    expect(pageOne.body.data.total).toBe(2);
    expect(
      pageOne.body.data.items.map((item: { listingNumber: string }) => item.listingNumber),
    ).toEqual([second.listingNumber]);
    expect(
      pageTwo.body.data.items.map((item: { listingNumber: string }) => item.listingNumber),
    ).toEqual([first.listingNumber]);
  });

  it("signed-in search excludes blocked listing, detail still opens, public search unaffected", async () => {
    const world = await aDirectoryWorld();
    const l1 = await approvedListing(world, world.organizationA);
    const l2 = await approvedListing(world, world.organizationA);
    const viewer = await signInCustomer(harness, world.organizationA);
    const viewerCookies = asCustomerCookies(viewer.session);

    // Block l1
    await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks",
      cookies: viewerCookies,
      body: { listingNumber: l1.listingNumber },
    });

    // Signed-in search excludes l1
    const searchRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      cookies: viewerCookies,
    });
    expect(searchRes.status).toBe(200);
    const listingNumbers = searchRes.body.data.items.map(
      (i: { listingNumber: string }) => i.listingNumber,
    );
    expect(listingNumbers).toContain(l2.listingNumber);
    expect(listingNumbers).not.toContain(l1.listingNumber);

    // Detail page still opens
    const detailRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: `/listings/${l1.listingNumber}`,
      cookies: viewerCookies,
    });
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.listingNumber).toBe(l1.listingNumber);

    // Public/unauthenticated search includes l1
    const publicSearch = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
    });
    expect(publicSearch.status).toBe(200);
    const publicNumbers = publicSearch.body.data.items.map(
      (i: { listingNumber: string }) => i.listingNumber,
    );
    expect(publicNumbers).toContain(l1.listingNumber);
  });

  it("blocking own listing returns 422", async () => {
    const world = await aDirectoryWorld();
    const l1 = await approvedListing(world, world.organizationA);

    const ownRes = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks",
      cookies: l1.ownerCookies,
      body: { listingNumber: l1.listingNumber },
    });
    expect(ownRes.status).toBe(422);
  });

  it("cross-org listing returns 404", async () => {
    const world = await aDirectoryWorld();
    const lA = await approvedListing(world, world.organizationA);
    const viewerB = await signInCustomer(harness, world.organizationB);
    const viewerCookies = asCustomerCookies(viewerB.session);

    const crossRes = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationB,
      suffix: "/my/listing-blocks",
      cookies: viewerCookies,
      body: { listingNumber: lA.listingNumber },
    });
    expect(crossRes.status).toBe(404);
  });

  it("501st block returns 409", async () => {
    const world = await aDirectoryWorld();
    const l1 = await approvedListing(world, world.organizationA);
    const viewer = await signInCustomer(harness, world.organizationA);
    const viewerCookies = asCustomerCookies(viewer.session);

    // Seed 500 dummy blocks in DB for this customer account
    const blocksColl = harness.connections.tenantShared.collection("listing_blocks");
    const docs = [];
    for (let i = 0; i < DIRECTORY_SAFETY_RULES.blocksPerAccountMax; i++) {
      docs.push({
        organizationId: world.organizationA,
        listingBlockId: newId(),
        customerAccountId: viewer.verifyResponse.body.data.customerAccountId,
        listingId: newId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      });
    }
    await blocksColl.insertMany(docs);

    // Attempting 501st block returns 409
    const limitRes = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing-blocks",
      cookies: viewerCookies,
      body: { listingNumber: l1.listingNumber },
    });
    expect(limitRes.status).toBe(409);
  });
});
