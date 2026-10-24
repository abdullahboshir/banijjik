import {
  CUSTOM_FIELD_TYPE,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  SEED_INDUSTRY_TEMPLATE_KEY,
} from "@banijjik/contracts";
import { LISTING_STATUS, type ListingStatus } from "@banijjik/contracts/directory";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import { enableDirectoryForWorld } from "../../../test-support/directory-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { callStorefront } from "../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../test-support/two-organizations.js";
import { buildDirectoryBlockReader } from "../../platform/industry/index.js";
import { refreshListingStats } from "./application/handlers/listing-stats.handler.js";
import { LISTING_COLLECTION_NAME } from "./infrastructure/listing.schema.js";
import { MongoListingStatsRepository } from "./infrastructure/mongo-listing-stats.repository.js";
import { LISTING_STATS_COLLECTION_NAME } from "./infrastructure/listing-stats.schema.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [] });
  // Signup accepts only a PUBLISHED template; the seed rows start as drafts (as matrimony-template.test does).
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY },
      { $set: { status: "PUBLISHED" }, $inc: { version: 1 } },
    );
});

afterAll(async () => {
  await harness.dispose();
});

/** The MATRIMONY seed names `gender` as its home statistics field (M.6a decision 6). */
const STATS_FIELD = "gender";

async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY,
  });
  await enableDirectoryForWorld(world);
  const hidden = await world.alice.call("post", `/orgs/${world.organizationA}/custom-fields`, {
    entityType: "listing",
    fieldKey: "internal_note",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    label: { bn: "নোট", en: "Note" },
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 900,
    listingTier: "PUBLIC",
  });
  if (hidden.status !== 201) throw new Error(`field failed: ${JSON.stringify(hidden.body)}`);
  return world;
}

function listingsCollection() {
  return harness.connections.tenantShared.collection(LISTING_COLLECTION_NAME);
}

async function insertListing(
  organizationId: string,
  status: ListingStatus,
  gender: string | null,
): Promise<string> {
  const listingId = newId();
  await listingsCollection().insertOne({
    listingId,
    organizationId,
    listingNumber: `BIO-${newId()}`,
    ownerCustomerAccountId: newId(),
    status,
    customFields: gender === null ? {} : { [STATS_FIELD]: gender },
    customFieldSearch: [],
    photoFileIds: [],
    consentsAccepted: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUserId: null,
    updatedByUserId: null,
  });
  return listingId;
}

async function setListingStatus(listingId: string, status: ListingStatus): Promise<void> {
  await listingsCollection().updateOne({ listingId }, { $set: { status } });
}

/** What the stats handler does on a listing event, run in the business's context as the worker does. */
async function refreshFor(organizationId: string): Promise<boolean> {
  return runInOrganizationContext(organizationId, () =>
    refreshListingStats(
      { stats: new MongoListingStatsRepository(), template: buildDirectoryBlockReader() },
      asId<OrganizationId>(organizationId),
    ),
  );
}

function statsOf(organizationId: string) {
  return callStorefront(harness.app, {
    method: "get",
    organizationId,
    suffix: "/directory/stats",
  });
}

function countOf(
  body: { data: { field: { options: { option: string; count: number }[] } | null } },
  option: string,
): number | undefined {
  return body.data.field?.options.find((row) => row.option === option)?.count;
}

describe("Directory home statistics (M.6a decisions 3 to 5)", () => {
  it("stats count approved listings by the template's field and ignore other statuses", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await insertListing(organizationA, LISTING_STATUS.APPROVED, "MALE");
    await insertListing(organizationA, LISTING_STATUS.APPROVED, "MALE");
    await insertListing(organizationA, LISTING_STATUS.APPROVED, "FEMALE");
    await insertListing(organizationA, LISTING_STATUS.APPROVED, null);
    await insertListing(organizationA, LISTING_STATUS.SUBMITTED, "MALE");
    await insertListing(organizationA, LISTING_STATUS.ARCHIVED, "FEMALE");
    const hiddenId = await insertListing(organizationA, LISTING_STATUS.HIDDEN, "FEMALE");
    await refreshFor(organizationA);

    const first = await statsOf(organizationA);
    expect(first.body.data.approvedCount).toBe(4);
    expect(countOf(first.body, "MALE")).toBe(2);
    expect(countOf(first.body, "FEMALE")).toBe(1);

    await setListingStatus(hiddenId, LISTING_STATUS.APPROVED);
    await refreshFor(organizationA);
    const revealed = await statsOf(organizationA);
    expect(revealed.body.data.approvedCount).toBe(5);
    expect(countOf(revealed.body, "FEMALE")).toBe(2);
  });

  it("stats read zeros before the first listing event and never scans listings", async () => {
    const world = await aWorld();
    const organizationB = world.organizationB;
    await insertListing(organizationB, LISTING_STATUS.APPROVED, "MALE");
    const scan = vi.spyOn(MongoListingStatsRepository.prototype, "countApprovedByOption");
    try {
      const response = await statsOf(organizationB);
      expect(response.status).toBe(200);
      expect(response.body.data.approvedCount).toBe(0);
      expect(countOf(response.body, "MALE")).toBe(0);
      expect(scan).not.toHaveBeenCalled();
    } finally {
      scan.mockRestore();
    }
  });

  it("a second delivery of the same listing event leaves the stats row unchanged", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await insertListing(organizationA, LISTING_STATUS.APPROVED, "FEMALE");
    expect(await refreshFor(organizationA)).toBe(true);
    const statsCollection = harness.connections.tenantShared.collection(
      LISTING_STATS_COLLECTION_NAME,
    );
    const before = await statsCollection.findOne({ organizationId: organizationA });

    expect(await refreshFor(organizationA)).toBe(false);
    const after = await statsCollection.findOne({ organizationId: organizationA });
    expect(after?.["version"]).toBe(before?.["version"]);
    expect(after?.["computedAt"]).toEqual(before?.["computedAt"]);
  });

  it("the form read returns only storefront-visible listing fields with their tiers and sections", async () => {
    const world = await aWorld();
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/directory/form",
    });
    expect(response.status).toBe(200);
    const keys = response.body.data.fields.map((field: { fieldKey: string }) => field.fieldKey);
    expect(keys).toContain(STATS_FIELD);
    expect(keys).not.toContain("internal_note");
    const gender = response.body.data.fields.find(
      (field: { fieldKey: string }) => field.fieldKey === STATS_FIELD,
    );
    expect(gender.listingTier).toBe("PUBLIC");
    expect(gender.options).toEqual(["MALE", "FEMALE"]);
    const sectionKeys = response.body.data.sections.map(
      (section: { sectionKey: string }) => section.sectionKey,
    );
    expect(sectionKeys).toContain("general");
    expect(response.body.data.photoPolicy).toBe("NONE");
    expect(response.body.data).not.toHaveProperty("rejectionReasons");
  });

  it("form and stats answer 404 when the directory module is off", async () => {
    const world = await aWorld();
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.DIRECTORY,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    });
    for (const suffix of ["/directory/form", "/directory/stats"]) {
      const response = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix,
      });
      expect(response.status, suffix).toBe(404);
    }
  });
});
