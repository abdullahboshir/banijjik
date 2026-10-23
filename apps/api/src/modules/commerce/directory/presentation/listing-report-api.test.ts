import {
  ALL_LOCATIONS,
  AUDIT_ACTION,
  CUSTOM_FIELD_TYPE,
  PERMISSION_KEY,
} from "@banijjik/contracts";
import { CONTACT_EVENT_TYPE, CUSTOMER_ACCOUNT_STATUS } from "@banijjik/contracts/contact";
import {
  DIRECTORY_EVENT_TYPE,
  DIRECTORY_SAFETY_RULES,
  DIRECTORY_SEARCH_RULES,
  LISTING_REPORT_OUTCOME,
  LISTING_STATUS,
} from "@banijjik/contracts/directory";
import { newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshIp } from "../../../../test-support/auth-api-client.js";
import { enableDirectoryForWorld } from "../../../../test-support/directory-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import { addMemberWithAssignments } from "../../../../test-support/rbac-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { eventHandlerRegistry } from "../../../../kernel/events/index.js";
import {
  runEventHandler,
  type HandlerRunResult,
} from "../../../../kernel/events/handler-runner.js";
import { buildAuditRecorder } from "../../../core/audit/index.js";
import { registerDirectoryEventHandlers } from "../index.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  // Empty tenantRouters forces the probe v1 router so the permissive template reader is used.
  harness = await startIamApi({ templateReader, tenantRouters: [] });
  // The worker registers the directory handlers the same way before it starts (ADR-090).
  registerDirectoryEventHandlers({
    clock: harness.clock,
    audit: buildAuditRecorder(harness.clock),
  });
});

afterAll(async () => {
  await harness.dispose();
});

const REPORT_REASONS = [
  { reasonKey: "false_info", label: { bn: "মিথ্যা তথ্য", en: "False information" } },
  { reasonKey: "already_married", label: { bn: "বিবাহিত", en: "Already married" } },
];

const DIRECTORY_BLOCK = {
  sections: [{ sectionKey: "basics", label: { bn: "মূল", en: "Basics" } }],
  consents: [{ consentKey: "truthful", text: { bn: "সত্য", en: "Truthful" } }],
  rejectionReasons: [
    { reasonKey: "unclear", label: { bn: "অস্পষ্ট", en: "Unclear" }, isFinal: false },
  ],
  reportReasons: REPORT_REASONS,
  listingNumberPrefix: "BD",
};

async function seedDirectoryBlock(organizationId: string, block: object): Promise<void> {
  const org = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  if (org === null) throw new Error("organization missing");
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey: org["industryTemplateKey"] as string },
      { $set: { "configuration.directory": block }, $inc: { version: 1 } },
    );
}

async function aDirectoryWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  await enableDirectoryForWorld(world);
  await seedDirectoryBlock(world.organizationA, DIRECTORY_BLOCK);
  await seedDirectoryBlock(world.organizationB, DIRECTORY_BLOCK);
  const owners = [
    { staff: world.alice, organizationId: world.organizationA },
    { staff: world.bob, organizationId: world.organizationB },
  ];
  for (const owner of owners) {
    const created = await owner.staff.call("post", `/orgs/${owner.organizationId}/custom-fields`, {
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
    if (created.status !== 201) throw new Error(`custom field failed: ${created.status}`);
  }
  return world;
}

interface ListingOwner {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: string;
  readonly ownerCookies: Record<string, string>;
  readonly version: number;
}

/** A new customer's listing, submitted and approved by that organization's staff. */
async function approvedListing(
  world: TwoOrganizations,
  organizationId: string,
): Promise<ListingOwner> {
  const cookies = await signedInCookies(organizationId);
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
  if (submitted.status !== 200) {
    throw new Error(`submit failed: ${JSON.stringify(submitted.body)}`);
  }
  const staff = organizationId === world.organizationA ? world.alice : world.bob;
  const approved = await staff.call(
    "post",
    `/orgs/${organizationId}/directory/listings/${listingId}/approve`,
    { version: submitted.body.data.version as number },
  );
  if (approved.status !== 200) {
    throw new Error(`approve failed: ${JSON.stringify(approved.body)}`);
  }
  return {
    listingId,
    listingNumber: approved.body.data.listingNumber as string,
    ownerCustomerAccountId: approved.body.data.ownerCustomerAccountId as string,
    ownerCookies: cookies,
    version: approved.body.data.version as number,
  };
}

async function signedInCookies(organizationId: string): Promise<Record<string, string>> {
  const customer = await signInCustomer(harness, organizationId);
  return asCustomerCookies(customer.session);
}

async function fileReport(
  organizationId: string,
  listingNumber: string,
  cookies: Record<string, string>,
  reasonKey = "false_info",
  note?: string,
): Promise<Response> {
  return callStorefront(harness.app, {
    method: "post",
    organizationId,
    suffix: `/listings/${listingNumber}/reports`,
    cookies,
    ...(note === undefined ? { body: { reasonKey } } : { body: { reasonKey, note } }),
  });
}

interface ReportRow {
  readonly listingReportId: string;
  readonly status: string;
  readonly reasonKey: string;
}

async function reportRows(organizationId: string): Promise<ReportRow[]> {
  const rows = await harness.connections.tenantShared
    .collection("listing_reports")
    .find({ organizationId })
    .toArray();
  return rows.map((row) => ({
    listingReportId: row["listingReportId"] as string,
    status: row["status"] as string,
    reasonKey: row["reasonKey"] as string,
  }));
}

interface AccountRow {
  readonly contactId: string;
  readonly status: string;
  readonly version: number;
}

async function accountRow(
  organizationId: string,
  customerAccountId: string,
): Promise<AccountRow | null> {
  const row = await harness.connections.tenantShared
    .collection("customer_accounts")
    .findOne({ organizationId, customerAccountId });
  if (row === null) return null;
  return {
    contactId: row["contactId"] as string,
    status: row["status"] as string,
    version: row["version"] as number,
  };
}

/** The staff ban, the way the contact screen asks for it (M.7 decision 7). */
async function blockFromScreen(
  world: TwoOrganizations,
  organizationId: string,
  customerAccountId: string,
  unblock = false,
): Promise<number> {
  const account = await accountRow(organizationId, customerAccountId);
  if (account === null) throw new Error("customer account missing");
  const suffix = unblock ? "unblock" : "block";
  const response = await world.alice.call(
    "post",
    `/orgs/${organizationId}/contacts/${account.contactId}/customer-account/${suffix}`,
    { version: account.version },
  );
  return response.status;
}

/** Runs directory.hideOnAccountBlocked over the newest blocked-account event, as the worker does. */
async function runBlockedAccountHandler(
  organizationId: string,
  isEffective = true,
): Promise<HandlerRunResult> {
  const event = (await harness.connections.platform
    .collection("outbox_events")
    .find({ organizationId, type: CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_BLOCKED })
    .sort({ createdAt: -1 })
    .limit(1)
    .next()) as { eventId: string; type: string } | null;
  if (event === null) throw new Error("the blocked-account event is missing");
  return runEventHandler(
    {
      eventId: event.eventId,
      handlerKey: "directory.hideOnAccountBlocked",
      type: event.type,
      organizationId,
    },
    eventHandlerRegistry,
    { isEffective: async () => isEffective },
  );
}

async function statusOf(world: TwoOrganizations, listingId: string): Promise<string> {
  const detail = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/directory/listings/${listingId}`,
  );
  return detail.body.data.status as string;
}

function concealRows(listingId: string): Promise<number> {
  return harness.connections.tenantShared
    .collection("audit_logs")
    .countDocuments({ entityId: listingId, action: AUDIT_ACTION.LISTING_CONCEALED });
}

async function staffWith(
  world: TwoOrganizations,
  permissionKeys: readonly string[],
): Promise<ApiActor> {
  const role = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
    name: `report staff ${newId()}`,
    permissionKeys,
  });
  if (role.status !== 201) throw new Error(`role failed: ${JSON.stringify(role.body)}`);
  const member = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId: role.body.data.roleId as string },
  ]);
  return member.actor;
}

function resolvePath(organizationId: string, listingId: string): string {
  return `/orgs/${organizationId}/directory/listings/${listingId}/reports/resolve`;
}

async function resolveAs(
  actor: ApiActor,
  organizationId: string,
  listingId: string,
  reportIds: readonly string[],
  outcome: string,
): Promise<Response> {
  return actor.call("post", resolvePath(organizationId, listingId), { reportIds, outcome });
}

describe("filing a listing report", () => {
  it("files a report on an approved listing and returns it", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);

    const filed = await fileReport(
      world.organizationA,
      listing.listingNumber,
      reporter,
      "false_info",
      "the photo is old",
    );

    expect(filed.status).toBe(201);
    expect(filed.body.data).toMatchObject({
      reasonKey: "false_info",
      note: "the photo is old",
      status: "OPEN",
      outcome: null,
      resolvedAt: null,
      resolvedByUserId: null,
    });
    expect(filed.body.data.reporterCustomerAccountId).not.toBe(listing.ownerCustomerAccountId);
    expect(await reportRows(world.organizationA)).toHaveLength(1);
  });

  it("returns the same open report when the reporter files again", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);

    const first = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const again = await fileReport(
      world.organizationA,
      listing.listingNumber,
      reporter,
      "already_married",
    );

    expect(again.status).toBe(200);
    expect(again.body.data.listingReportId).toBe(first.body.data.listingReportId);
    expect(again.body.data.reasonKey).toBe("false_info");
    expect(await reportRows(world.organizationA)).toHaveLength(1);
  });

  it("refuses a report on the caller's own listing", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);

    const refused = await fileReport(
      world.organizationA,
      listing.listingNumber,
      listing.ownerCookies,
    );

    expect(refused.status).toBe(409);
    expect(refused.body.error.messageKey).toBe("errors.directory_report_own_listing");
    expect(await reportRows(world.organizationA)).toHaveLength(0);
  });

  it("refuses an unknown reason", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);

    const refused = await fileReport(
      world.organizationA,
      listing.listingNumber,
      reporter,
      "not_a_reason",
    );

    expect(refused.status).toBe(400);
    expect(refused.body.error.messageKey).toBe("errors.directory_report_unknown_reason");
  });

  it("refuses when the template has no report reasons", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    await seedDirectoryBlock(world.organizationA, { ...DIRECTORY_BLOCK, reportReasons: [] });

    const refused = await fileReport(world.organizationA, listing.listingNumber, reporter);

    expect(refused.status).toBe(409);
    expect(refused.body.error.messageKey).toBe("errors.directory_report_not_configured");
  });

  it("answers 404 for a draft, hidden or archived listing", async () => {
    const world = await aDirectoryWorld();
    const reporter = await signedInCookies(world.organizationA);
    const owner = await signedInCookies(world.organizationA);
    const draft = await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: owner,
      body: { customFields: { age_band: "25" } },
    });
    const listingId = draft.body.data.listingId as string;
    const number = draft.body.data.listingNumber as string;
    expect((await fileReport(world.organizationA, number, reporter)).status).toBe(404);

    const submitted = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing/submit",
      cookies: owner,
      body: { consents: [{ consentKey: "truthful" }] },
    });
    const approved = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listingId}/approve`,
      { version: submitted.body.data.version as number },
    );
    expect(approved.status).toBe(200);
    expect((await fileReport(world.organizationA, number, reporter)).status).toBe(201);

    const hidden = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listingId}/hide`,
      { version: approved.body.data.version as number },
    );
    expect(hidden.status).toBe(200);
    expect((await fileReport(world.organizationA, number, reporter)).status).toBe(404);

    const revealed = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listingId}/unhide`,
      { version: hidden.body.data.version as number },
    );
    expect(revealed.status).toBe(200);
    const archived = await callStorefront(harness.app, {
      method: "delete",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: owner,
    });
    expect(archived.status).toBe(204);
    expect((await fileReport(world.organizationA, number, reporter)).status).toBe(404);
  });

  it("requires a signed-in customer", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);

    const refused = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: `/listings/${listing.listingNumber}/reports`,
      body: { reasonKey: "false_info" },
    });
    expect(refused.status).toBe(401);

    const reasons = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listing-report-reasons",
    });
    expect(reasons.status).toBe(401);
  });

  it("lists the template report reasons for the customer form", async () => {
    const world = await aDirectoryWorld();
    const reporter = await signedInCookies(world.organizationA);

    const reasons = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listing-report-reasons",
      cookies: reporter,
    });

    expect(reasons.status).toBe(200);
    expect(reasons.body.data).toEqual(REPORT_REASONS);
  });

  it("stops the eleventh report of the business day", async () => {
    // Move to the next 19:30 UTC: 01:30 in Dhaka, so the organization's business day is a
    // different calendar day from the UTC day of the same instant (M.7 decision 3).
    const now = harness.clock.now();
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 19, 30),
    );
    if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
    harness.clock.advanceSeconds((target.getTime() - now.getTime()) / 1000);
    expect(target.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" })).not.toBe(
      target.toISOString().slice(0, 10),
    );
    // The world is built after the move, so the staff and customer sessions are minted in it.
    const world = await aDirectoryWorld();
    const reporter = await signedInCookies(world.organizationA);

    const limit = DIRECTORY_SAFETY_RULES.reportsPerAccountPerDay;
    const statuses: number[] = [];
    for (let index = 0; index < limit + 1; index += 1) {
      const listing = await approvedListing(world, world.organizationA);
      statuses.push(
        (await fileReport(world.organizationA, listing.listingNumber, reporter)).status,
      );
    }

    expect(statuses.slice(0, limit)).toEqual(new Array(limit).fill(201));
    expect(statuses.at(-1)).toBe(429);
    expect(await reportRows(world.organizationA)).toHaveLength(limit);
  });
});

describe("the staff report queue", () => {
  it("queues listings with open reports, oldest first, grouped by listing", async () => {
    const world = await aDirectoryWorld();
    const reporter = await signedInCookies(world.organizationA);
    const first = await approvedListing(world, world.organizationA);
    const second = await approvedListing(world, world.organizationA);
    // The queue orders listings by their oldest open report, so the filings need different instants.
    await fileReport(world.organizationA, second.listingNumber, reporter);
    harness.clock.advanceSeconds(60);
    await fileReport(world.organizationA, first.listingNumber, reporter, "already_married");
    harness.clock.advanceSeconds(60);
    await fileReport(
      world.organizationA,
      first.listingNumber,
      await signedInCookies(world.organizationA),
    );

    const queue = await world.alice.call("get", `/orgs/${world.organizationA}/directory/reports`);

    expect(queue.status).toBe(200);
    expect(queue.body.data.total).toBe(2);
    const items = queue.body.data.items as Record<string, unknown>[];
    expect(items.map((row) => row["listingId"])).toEqual([second.listingId, first.listingId]);
    expect(items[0]).toMatchObject({ openCount: 1, listingStatus: LISTING_STATUS.APPROVED });
    expect(items[1]).toMatchObject({
      listingNumber: first.listingNumber,
      openCount: 2,
      reasonKeys: ["already_married", "false_info"],
    });
    expect(items[1]).not.toHaveProperty("note");

    const paged = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/reports?page=2&limit=1`,
    );
    const pageTwo = paged.body.data.items as Record<string, unknown>[];
    expect(pageTwo).toHaveLength(1);
    expect(pageTwo[0]?.["listingId"]).toBe(first.listingId);
    expect(paged.body.data.limit).toBe(1);

    const overLimit = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/reports?limit=101`,
    );
    expect(overLimit.status).toBe(400);
  });

  it("lists one listing's reports and filters them by status", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const resolved = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.DISMISSED,
    );
    expect(resolved.status).toBe(200);

    const other = await approvedListing(world, world.organizationA);
    await fileReport(world.organizationA, other.listingNumber, reporter);

    const open = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listing.listingId}/reports?status=OPEN`,
    );
    const all = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listing.listingId}/reports`,
    );
    expect(open.body.data.items).toEqual([]);
    expect(all.body.data.items).toHaveLength(1);
    expect(all.body.data.items[0]).toMatchObject({
      status: "RESOLVED",
      outcome: LISTING_REPORT_OUTCOME.DISMISSED,
      reasonKey: "false_info",
    });
    expect(all.body.data.items[0].resolvedByUserId).toBeTruthy();

    const unknownListing = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${newId()}/reports`,
    );
    expect(unknownListing.status).toBe(404);
  });

  it("never sends reports or reporter ids to the listing owner", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    await fileReport(
      world.organizationA,
      listing.listingNumber,
      await signedInCookies(world.organizationA),
    );

    const mine = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: listing.ownerCookies,
    });

    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body)).not.toContain("listingReport");
    expect(JSON.stringify(mine.body)).not.toContain("reporter");
    expect(Object.keys(mine.body.data)).not.toContain("reports");
  });
});

describe("resolving listing reports", () => {
  it("resolves only the listed reports and leaves a newer report open", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const older = await fileReport(
      world.organizationA,
      listing.listingNumber,
      await signedInCookies(world.organizationA),
    );
    const newer = await fileReport(
      world.organizationA,
      listing.listingNumber,
      await signedInCookies(world.organizationA),
    );

    const resolved = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [older.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.WARNED,
    );

    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toHaveLength(1);
    expect(resolved.body.data[0]).toMatchObject({
      listingReportId: older.body.data.listingReportId,
      status: "RESOLVED",
      outcome: LISTING_REPORT_OUTCOME.WARNED,
    });
    const queue = await world.alice.call("get", `/orgs/${world.organizationA}/directory/reports`);
    expect(queue.body.data.items).toHaveLength(1);
    expect(queue.body.data.items[0]).toMatchObject({
      listingId: listing.listingId,
      openCount: 1,
    });
    const rows = await reportRows(world.organizationA);
    const openRows = rows.filter((row) => row.status === "OPEN");
    expect(openRows).toHaveLength(1);
    expect(openRows[0]?.listingReportId).toBe(newer.body.data.listingReportId);
  });

  it("refuses stale or foreign report ids and writes nothing", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const reportId = filed.body.data.listingReportId as string;

    const first = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [reportId],
      LISTING_REPORT_OUTCOME.DISMISSED,
    );
    expect(first.status).toBe(200);

    const stale = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [reportId],
      LISTING_REPORT_OUTCOME.DISMISSED,
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.messageKey).toBe("errors.directory_report_stale");

    const unknown = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [newId()],
      LISTING_REPORT_OUTCOME.DISMISSED,
    );
    expect(unknown.status).toBe(409);

    const otherListing = await approvedListing(world, world.organizationA);
    const otherFiled = await fileReport(world.organizationA, otherListing.listingNumber, reporter);
    const otherReportId = otherFiled.body.data.listingReportId as string;

    const foreign = await resolveAs(
      world.alice,
      world.organizationA,
      otherListing.listingId,
      [reportId],
      LISTING_REPORT_OUTCOME.DISMISSED,
    );
    expect(foreign.status).toBe(409);

    const rows = await reportRows(world.organizationA);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.listingReportId === reportId)?.status).toBe("RESOLVED");
    const openRows = rows.filter((row) => row.status === "OPEN");
    expect(openRows).toHaveLength(1);
    expect(openRows[0]?.listingReportId).toBe(otherReportId);
  });

  it("hides an approved listing when resolving with LISTING_HIDDEN", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);

    const resolved = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.LISTING_HIDDEN,
    );

    expect(resolved.status).toBe(200);
    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.HIDDEN);
    expect(await concealRows(listing.listingId)).toBe(1);
  });

  it("closes reports without a write when the listing is already hidden", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const hidden = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/directory/listings/${listing.listingId}/hide`,
      { version: listing.version },
    );
    expect(hidden.status).toBe(200);

    const resolved = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.LISTING_HIDDEN,
    );

    expect(resolved.status).toBe(200);
    expect(resolved.body.data[0]).toMatchObject({
      status: "RESOLVED",
      outcome: LISTING_REPORT_OUTCOME.LISTING_HIDDEN,
    });
    // The staff hide is the only write: resolving does not hide the listing a second time.
    expect(hidden.body.data.version).toBe(listing.version + 1);
    expect(await concealRows(listing.listingId)).toBe(1);
  });

  it("refuses LISTING_HIDDEN for an archived listing", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const archived = await callStorefront(harness.app, {
      method: "delete",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: listing.ownerCookies,
    });
    expect(archived.status).toBe(204);

    const refused = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.LISTING_HIDDEN,
    );

    expect(refused.status).toBe(409);
    expect(refused.body.error.messageKey).toBe("errors.directory_report_cannot_hide");
    expect((await reportRows(world.organizationA))[0]?.status).toBe("OPEN");
  });

  it("blocks the owner's account when resolving with ACCOUNT_BLOCKED, and the handler hides the listing", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);

    const resolved = await resolveAs(
      world.alice,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.ACCOUNT_BLOCKED,
    );

    expect(resolved.status).toBe(200);
    const account = await accountRow(world.organizationA, listing.ownerCustomerAccountId);
    expect(account?.status).toBe(CUSTOMER_ACCOUNT_STATUS.BLOCKED);
    // The ban never touches the listing: the handler is the only path that hides it (decision 7).
    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.APPROVED);

    expect(await runBlockedAccountHandler(world.organizationA)).toBe("HANDLED");
    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.HIDDEN);
  });

  it("refuses LISTING_HIDDEN without directory.listing.hide, and nothing is written", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const resolver = await staffWith(world, [PERMISSION_KEY.DIRECTORY_REPORT_RESOLVE]);

    const refused = await resolveAs(
      resolver,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.LISTING_HIDDEN,
    );

    expect(refused.status).toBe(403);
    expect(refused.body.error.details.permissionKey).toBe(PERMISSION_KEY.DIRECTORY_LISTING_HIDE);
    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.APPROVED);
    expect((await reportRows(world.organizationA))[0]?.status).toBe("OPEN");
    expect(await concealRows(listing.listingId)).toBe(0);
  });

  it("refuses ACCOUNT_BLOCKED without contact.customerAccount.block, and nothing is written", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const resolver = await staffWith(world, [
      PERMISSION_KEY.DIRECTORY_REPORT_RESOLVE,
      PERMISSION_KEY.DIRECTORY_LISTING_HIDE,
    ]);

    const refused = await resolveAs(
      resolver,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.ACCOUNT_BLOCKED,
    );

    expect(refused.status).toBe(403);
    expect(refused.body.error.details.permissionKey).toBe(
      PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK,
    );
    const account = await accountRow(world.organizationA, listing.ownerCustomerAccountId);
    expect(account?.status).toBe(CUSTOMER_ACCOUNT_STATUS.ACTIVE);
    expect((await reportRows(world.organizationA))[0]?.status).toBe("OPEN");
  });

  it("refuses the queue without directory.report.read and the resolve without directory.report.resolve", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listing.listingNumber, reporter);
    const resolverOnly = await staffWith(world, [PERMISSION_KEY.DIRECTORY_REPORT_RESOLVE]);
    const readerOnly = await staffWith(world, [PERMISSION_KEY.DIRECTORY_REPORT_READ]);

    const queueDenied = await resolverOnly.call(
      "get",
      `/orgs/${world.organizationA}/directory/reports`,
    );
    expect(queueDenied.status).toBe(403);

    const resolved = await resolveAs(
      resolverOnly,
      world.organizationA,
      listing.listingId,
      [filed.body.data.listingReportId as string],
      LISTING_REPORT_OUTCOME.DISMISSED,
    );
    expect(resolved.status).toBe(200);

    const resolveDenied = await readerOnly.call(
      "post",
      resolvePath(world.organizationA, listing.listingId),
      {
        reportIds: [newId()],
        outcome: LISTING_REPORT_OUTCOME.DISMISSED,
      },
    );
    expect(resolveDenied.status).toBe(403);

    const queue = await readerOnly.call("get", `/orgs/${world.organizationA}/directory/reports`);
    expect(queue.status).toBe(200);
    const listed = await readerOnly.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listing.listingId}/reports`,
    );
    expect(listed.status).toBe(200);
  });

  it("keeps another organization out of the reports of the first", async () => {
    const world = await aDirectoryWorld();
    const listingA = await approvedListing(world, world.organizationA);
    const listingB = await approvedListing(world, world.organizationB);
    const reporter = await signedInCookies(world.organizationA);
    const filed = await fileReport(world.organizationA, listingA.listingNumber, reporter);
    const reportId = filed.body.data.listingReportId as string;

    const crossQueue = await world.bob.call(
      "get",
      `/orgs/${world.organizationA}/directory/reports`,
    );
    expect(crossQueue.status).toBe(404);
    const crossList = await world.bob.call(
      "get",
      `/orgs/${world.organizationA}/directory/listings/${listingA.listingId}/reports`,
    );
    expect(crossList.status).toBe(404);
    const crossResolve = await world.bob.call(
      "post",
      resolvePath(world.organizationA, listingA.listingId),
      {
        reportIds: [reportId],
        outcome: LISTING_REPORT_OUTCOME.DISMISSED,
      },
    );
    expect(crossResolve.status).toBe(404);

    const queueB = await world.bob.call("get", `/orgs/${world.organizationB}/directory/reports`);
    expect(queueB.status).toBe(200);
    expect(queueB.body.data.items).toEqual([]);

    const foreignId = await world.bob.call(
      "post",
      `/orgs/${world.organizationB}/directory/listings/${listingB.listingId}/reports/resolve`,
      { reportIds: [reportId], outcome: LISTING_REPORT_OUTCOME.DISMISSED },
    );
    expect(foreignId.status).toBe(409);
    expect(foreignId.body.error.messageKey).toBe("errors.directory_report_stale");
    expect((await reportRows(world.organizationA))[0]?.status).toBe("OPEN");
  });
});

describe("the blocked-account handler", () => {
  it("hides the listing when its account is blocked from the contact screen", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);

    expect(await blockFromScreen(world, world.organizationA, listing.ownerCustomerAccountId)).toBe(
      200,
    );
    expect(await runBlockedAccountHandler(world.organizationA)).toBe("HANDLED");

    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.HIDDEN);
    expect(await concealRows(listing.listingId)).toBe(1);
    const events = await harness.connections.platform.collection("outbox_events").countDocuments({
      organizationId: world.organizationA,
      type: DIRECTORY_EVENT_TYPE.LISTING_HIDDEN,
    });
    expect(events).toBe(1);
  });

  it("does nothing twice when the handler runs again", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    await blockFromScreen(world, world.organizationA, listing.ownerCustomerAccountId);

    expect(await runBlockedAccountHandler(world.organizationA)).toBe("HANDLED");
    expect(await runBlockedAccountHandler(world.organizationA)).toBe("ALREADY_PROCESSED");

    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.HIDDEN);
    expect(await concealRows(listing.listingId)).toBe(1);
  });

  it("leaves a submitted listing unchanged", async () => {
    const world = await aDirectoryWorld();
    const owner = await signedInCookies(world.organizationA);
    const draft = await callStorefront(harness.app, {
      method: "put",
      organizationId: world.organizationA,
      suffix: "/my/listing",
      cookies: owner,
      body: { customFields: { age_band: "25" } },
    });
    const listingId = draft.body.data.listingId as string;
    const ownerAccountId = draft.body.data.ownerCustomerAccountId as string;
    const submitted = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/my/listing/submit",
      cookies: owner,
      body: { consents: [{ consentKey: "truthful" }] },
    });
    expect(submitted.body.data.status).toBe(LISTING_STATUS.SUBMITTED);

    expect(await blockFromScreen(world, world.organizationA, ownerAccountId)).toBe(200);
    await runBlockedAccountHandler(world.organizationA);

    expect(await statusOf(world, listingId)).toBe(LISTING_STATUS.SUBMITTED);
    expect(await concealRows(listingId)).toBe(0);
  });

  it("does not unhide on unblock", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    await blockFromScreen(world, world.organizationA, listing.ownerCustomerAccountId);
    expect(await runBlockedAccountHandler(world.organizationA)).toBe("HANDLED");

    const unblocked = await blockFromScreen(
      world,
      world.organizationA,
      listing.ownerCustomerAccountId,
      true,
    );
    expect(unblocked).toBe(200);

    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.HIDDEN);
  });

  it("skips the handler while the directory module is off", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    await blockFromScreen(world, world.organizationA, listing.ownerCustomerAccountId);

    expect(await runBlockedAccountHandler(world.organizationA, false)).toBe("SKIPPED_MODULE_OFF");
    expect(await statusOf(world, listing.listingId)).toBe(LISTING_STATUS.APPROVED);
  });
});

describe("the listing detail rate limit", () => {
  it("rate-limits the listing detail per IP", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const ip = freshIp();
    let lastStatus = 0;
    for (let index = 0; index < DIRECTORY_SEARCH_RULES.detailPerIp.limit + 1; index += 1) {
      const response = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: `/listings/${listing.listingNumber}`,
        ip,
      });
      lastStatus = response.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("rate-limits the listing detail per signed-in account", async () => {
    const world = await aDirectoryWorld();
    const listing = await approvedListing(world, world.organizationA);
    const reporter = await signedInCookies(world.organizationA);
    let lastStatus = 0;
    for (let index = 0; index < DIRECTORY_SEARCH_RULES.detailPerAccount.limit + 1; index += 1) {
      const response = await callStorefront(harness.app, {
        method: "get",
        organizationId: world.organizationA,
        suffix: `/listings/${listing.listingNumber}`,
        cookies: reporter,
      });
      lastStatus = response.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
