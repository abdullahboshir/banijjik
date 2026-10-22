import { kernelEventPublisher } from "../../../kernel/events/index.js";
import {
  draftBookingCompleted,
  draftExpensePosted,
  postJournalEntry,
} from "../accounting/index.js";
import { ALL_LOCATIONS, PERMISSION_KEY } from "@banijjik/contracts";
import { addMemberWithAssignments } from "../../../test-support/rbac-world.js";
import { createHash } from "node:crypto";
import {
  manualJournalContent,
  type ManualJournalEntryRequest,
} from "@banijjik/contracts/accounting";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { PostManualEntryUseCase, MongoJournalRepository } from "../accounting/index.js";
import { buildApprovalVerifier } from "../../core/iam/index.js";
import { buildAuditRecorder } from "../../core/audit/index.js";
import type { UserId } from "@banijjik/ids";
import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import type { AccountResponse } from "@banijjik/contracts/accounting";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTransaction } from "../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { systemClock } from "../../../kernel/time/index.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { createTwoOrganizations, type ApiActor } from "../../../test-support/two-organizations.js";
import { MongoAccountRepository, seedSystemAccounts } from "../accounting/index.js";
registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [] });
});
afterAll(async () => {
  await harness.dispose();
});
const money = (amount: number) => ({ amount, currency: "BDT" });
async function worldWithBooks() {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  for (const organizationId of [world.organizationA, world.organizationB]) {
    await writeModuleOverride({
      organizationId,
      moduleKey: MODULE_KEY.BOOKKEEPING,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
    await runInOrganizationContext(organizationId, () =>
      withTransaction(() =>
        seedSystemAccounts(
          { accounts: new MongoAccountRepository(), clock: systemClock },
          { organizationId: asId<OrganizationId>(organizationId), actorUserId: null },
        ),
      ),
    );
  }
  const response = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/bookkeeping/accounts`,
  );
  expect(response.status).toBe(200);
  const accounts = response.body.data as AccountResponse[];
  const account = (code: string): string => {
    const found = accounts.find((row) => row.accountCode === code);
    if (found === undefined) throw new Error(code);
    return found.accountId;
  };
  return { ...world, accounts, account, path: `/orgs/${world.organizationA}/bookkeeping` };
}
async function post(actor: ApiActor, path: string, body: object, key = newId()) {
  return actor.callWith({
    method: "post",
    path: path + "/journal/manual",
    body,
    idempotencyKey: key,
  });
}
function entry(debit: string, credit: string, amount = 10000) {
  return {
    businessDate: "2026-10-19",
    memo: "Opening capital",
    lines: [
      { accountId: debit, debit: money(amount) },
      { accountId: credit, credit: money(amount) },
    ],
  };
}
describe("bookkeeping ledger API", () => {
  it("posts an audited balanced entry once, survives replay-record loss, and reverses exactly once", async () => {
    const world = await worldWithBooks();
    const body = entry(world.account("CASH"), world.account("OWNER_EQUITY"));
    const key = newId();
    const response = await post(world.alice, world.path, body, key);
    expect(response.status).toBe(200);
    const journal = response.body.data;
    expect(journal.postingKey).toBe("manual:" + journal.journalEntryId);
    expect(journal.entryNumber).toBeTruthy();
    expect(journal.memo).toBe(body.memo);
    expect(
      await harness.connections.platform
        .collection("outbox_events")
        .countDocuments({ organizationId: world.organizationA, type: "accounting.journal.posted" }),
    ).toBe(1);
    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .findOne({ organizationId: world.organizationA, entityId: journal.journalEntryId });
    expect(audit?.["actorUserId"]).toBe(world.alice.userId);
    await harness.connections.platform
      .collection("idempotency_records")
      .deleteMany({ idempotencyKey: key });
    const replay = await post(world.alice, world.path, body, key);
    expect(replay.body.data.journalEntryId).toBe(journal.journalEntryId);
    await harness.connections.platform
      .collection("idempotency_records")
      .deleteMany({ idempotencyKey: key });
    expect(
      (await post(world.alice, world.path, { ...body, memo: "Changed payload" }, key)).status,
    ).toBe(409);
    const reversal = await world.alice.callWith({
      method: "post",
      path: world.path + "/journal/" + journal.journalEntryId + "/reverse",
      body: { businessDate: body.businessDate },
      idempotencyKey: newId(),
    });
    expect(reversal.status).toBe(200);
    expect(reversal.body.data.lines[0].credit.amount).toBe(10000);
    const duplicate = await world.alice.callWith({
      method: "post",
      path: world.path + "/journal/" + journal.journalEntryId + "/reverse",
      body: { businessDate: body.businessDate },
      idempotencyKey: newId(),
    });
    expect(duplicate.status).toBe(409);
    const trial = await world.alice.call("get", world.path + "/trial-balance?asOf=2026-10-20");
    expect(trial.body.data.balances).toBe(true);
    expect(
      trial.body.data.accounts.every(
        (row: { balance: { amount: number } }) => row.balance.amount === 0,
      ),
    ).toBe(true);
  });
  it("rejects unbalanced, zero, two-sided, future and foreign-account entries without journal damage", async () => {
    const world = await worldWithBooks();
    const body = entry(world.account("CASH"), world.account("OWNER_EQUITY"));
    const unbalanced = await post(world.alice, world.path, {
      ...body,
      lines: [body.lines[0], { accountId: world.account("OWNER_EQUITY"), credit: money(999) }],
    });
    expect(unbalanced.status).toBe(422);
    expect(
      (
        await post(
          world.alice,
          world.path,
          entry(world.account("CASH"), world.account("OWNER_EQUITY"), 0),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(world.alice, world.path, {
          ...body,
          lines: [{ ...body.lines[0], credit: money(10000) }, body.lines[1]],
        })
      ).status,
    ).toBe(400);
    expect(
      (await post(world.alice, world.path, { ...body, businessDate: "2999-01-01" })).status,
    ).toBe(422);
    expect(
      (await post(world.alice, world.path, entry(newId(), world.account("OWNER_EQUITY")))).status,
    ).toBe(404);
    const rows = await world.alice.call("get", world.path + "/journal");
    expect(rows.body.data).toHaveLength(0);
  });
  it("keeps display rename separate from system identity, checks versions and blocks archived lines", async () => {
    const world = await worldWithBooks();
    const system = world.accounts.find((row) => row.accountCode === "CASH");
    if (system === undefined) throw new Error("cash");
    expect(
      (
        await world.alice.call("patch", world.path + "/accounts/" + system.accountId, {
          version: system.version,
        })
      ).status,
    ).toBe(400);
    const renamed = await world.alice.call("patch", world.path + "/accounts/" + system.accountId, {
      version: system.version,
      name: { bn: "টাকা", en: "Till" },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.accountCode).toBe("CASH");
    expect(
      (
        await world.alice.call("patch", world.path + "/accounts/" + system.accountId, {
          version: system.version,
          name: { bn: "পুরনো", en: "Stale" },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await world.alice.call("patch", world.path + "/accounts/" + system.accountId, {
          version: 2,
          status: "ARCHIVED",
        })
      ).status,
    ).toBe(422);
    const created = await world.alice.call("post", world.path + "/accounts", {
      name: { bn: "ব্যাংক দুই", en: "Bank two" },
      accountType: "ASSET",
      parentAccountCode: "BANK",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.accountCode).toMatch(/^C-\d+$/u);
    const account = created.body.data;
    expect(
      (
        await world.alice.call("patch", world.path + "/accounts/" + account.accountId, {
          version: 1,
          status: "ARCHIVED",
        })
      ).status,
    ).toBe(200);
    expect(
      (await post(world.alice, world.path, entry(account.accountId, world.account("OWNER_EQUITY"))))
        .status,
    ).toBe(422);
  });
  it("calculates income minus expenses and retained earnings with a location filter", async () => {
    const world = await worldWithBooks();
    await post(
      world.alice,
      world.path,
      entry(world.account("CASH"), world.account("OWNER_EQUITY"), 10000),
    );
    await postAutomaticDrafts(
      world.organizationA,
      draftBookingCompleted({
        bookingId: newId(),
        businessDate: "2026-10-19",
        locationId: world.locationA1,
        kind: "SERVICE",
        revenueExcludingTax: { amount: 5000, currency: "BDT" },
        tax: { amount: 0, currency: "BDT" },
        advancesToSettle: { amount: 0, currency: "BDT" },
      }),
    );
    await postAutomaticDrafts(world.organizationA, [
      draftExpensePosted({
        expenseId: newId(),
        businessDate: "2026-10-19",
        locationId: world.locationA1,
        amount: { amount: 1000, currency: "BDT" },
        paidVia: "CASH",
        categoryAccountCode: "COGS",
        status: "POSTED",
      }),
    ]);
    await post(world.alice, world.path, {
      ...entry(world.account("CASH"), world.account("REVENUE_SERVICE"), 2000),
      locationId: world.locationA2,
    });
    const profit = await world.alice.call(
      "get",
      world.path + "/statements/profit-and-loss?from=2026-10-01&to=2026-10-20",
    );
    expect(profit.body.data.netProfit.amount).toBe(6000);
    const filtered = await world.alice.call(
      "get",
      world.path +
        "/statements/profit-and-loss?from=2026-10-01&to=2026-10-20&locationId=" +
        world.locationA1,
    );
    expect(filtered.body.data.netProfit.amount).toBe(4000);
    const sheet = await world.alice.call(
      "get",
      world.path + "/statements/balance-sheet?asOf=2026-10-20",
    );
    expect(sheet.body.data.isBalanced).toBe(true);
    expect(sheet.body.data.totalAssets.amount).toBe(16000);
    expect(sheet.body.data.retainedEarnings.amount).toBe(6000);
  });
  it("denies staff, foreign organization and foreign location writes; disabling the add-on hides routes and menu", async () => {
    const world = await worldWithBooks();
    const body = entry(world.account("CASH"), world.account("OWNER_EQUITY"));
    expect((await post(world.sam, world.path, body)).status).toBe(403);
    expect((await post(world.bob, world.path, body)).status).toBe(404);
    expect(
      (await post(world.alice, world.path, { ...body, locationId: world.locationB1 })).status,
    ).toBe(403);
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.BOOKKEEPING,
      effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
    });
    const disabled = await world.alice.call("get", world.path + "/accounts");
    expect(disabled.status).toBe(403);
    expect(disabled.body.error.code).toBe("MODULE_DISABLED");
    const config = await world.alice.call("get", `/orgs/${world.organizationA}/me/config`);
    expect(
      config.body.data.menu.some((row: { menuKey: string }) =>
        row.menuKey.startsWith("bookkeeping."),
      ),
    ).toBe(false);
    expect(
      (await world.alice.call("get", `/orgs/${world.organizationA}/accounting/accounts`)).status,
    ).toBe(200);
    await postAutomaticDrafts(
      world.organizationA,
      draftBookingCompleted({
        bookingId: newId(),
        businessDate: "2026-10-19",
        locationId: world.locationA1,
        kind: "SERVICE",
        revenueExcludingTax: { amount: 100, currency: "BDT" },
        tax: { amount: 0, currency: "BDT" },
        advancesToSettle: { amount: 0, currency: "BDT" },
      }),
    );
    const automatic = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/accounting/journal`,
    );
    expect(automatic.body.data).toHaveLength(1);
  });
  it("requires approval when the owner exception is disabled", async () => {
    const world = await worldWithBooks();
    const settings = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "bookkeeping.manualEntryOwnerWithoutApproval", value: false }],
    });
    expect(settings.status).toBe(200);
    expect(
      (
        await post(
          world.alice,
          world.path,
          entry(world.account("CASH"), world.account("OWNER_EQUITY")),
        )
      ).status,
    ).toBe(403);
  });
});
async function approvalFor(
  world: Awaited<ReturnType<typeof worldWithBooks>>,
  body: ManualJournalEntryRequest,
): Promise<string> {
  expect(
    (
      await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
        currentPassword: world.alice.person.password,
        pin: "1234",
      })
    ).status,
  ).toBe(204);
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${world.locationA1}`,
  );
  const subjectKey =
    "manual:" + createHash("sha256").update(manualJournalContent(body)).digest("hex");
  const granted = await world.alice.call("post", `/orgs/${world.organizationA}/approvals`, {
    action: "MANUAL_JOURNAL",
    subjectKey,
    amount: money(10000),
    locationId: world.locationA1,
    approverMemberId: approvers.body.data[0].memberId,
    pin: "1234",
  });
  expect(granted.status).toBe(200);
  return granted.body.data.approvalToken as string;
}
describe("bookkeeping failure and concurrency boundaries", () => {
  it("binds approval to exact lines, memo and date and consumes it once", async () => {
    const world = await worldWithBooks();
    const body = {
      ...entry(world.account("CASH"), world.account("OWNER_EQUITY")),
      locationId: world.locationA1,
    } as ManualJournalEntryRequest;
    const token = await approvalFor(world, body);
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "bookkeeping.manualEntryOwnerWithoutApproval", value: false }],
    });
    expect(
      (
        await post(world.alice, world.path, {
          ...body,
          memo: "Changed after approval",
          approvalToken: token,
        })
      ).status,
    ).toBe(403);
    expect((await post(world.alice, world.path, { ...body, approvalToken: token })).status).toBe(
      200,
    );
    expect((await post(world.alice, world.path, { ...body, approvalToken: token })).status).toBe(
      403,
    );
  });
  it("rolls back approval consumption, journal and audit if outbox publication fails", async () => {
    const world = await worldWithBooks();
    const body = {
      ...entry(world.account("CASH"), world.account("OWNER_EQUITY")),
      locationId: world.locationA1,
    } as ManualJournalEntryRequest;
    const approvalToken = await approvalFor(world, body);
    const audit = buildAuditRecorder(harness.clock);
    const beforeOutbox = await harness.connections.platform
      .collection("outbox_events")
      .countDocuments({ organizationId: world.organizationA });
    const beforeAudit = await harness.connections.tenantShared
      .collection("audit_logs")
      .countDocuments({ organizationId: world.organizationA });
    const useCase = new PostManualEntryUseCase({
      accounts: new MongoAccountRepository(),
      journals: new MongoJournalRepository(),
      audit,
      clock: harness.clock,
      approvals: buildApprovalVerifier({ audit, clock: harness.clock }),
      unitOfWork: new MongoUnitOfWork(),
      currencies: {
        async read() {
          return "BDT";
        },
      },
      policy: {
        async ownerMaySkip() {
          return false;
        },
      },
      locations: {
        async isActiveLocation() {
          return true;
        },
      },
      events: {
        async publish(type, payload) {
          await kernelEventPublisher.publish(type, payload);
          throw new Error("outbox unavailable");
        },
      },
    });
    await expect(
      runInOrganizationContext(world.organizationA, () =>
        useCase.execute({
          ...body,
          approvalToken,
          organizationId: asId<OrganizationId>(world.organizationA),
          actorUserId: asId<UserId>(world.alice.userId),
          allowedLocationIds: "ALL",
          idempotencyKey: newId(),
        }),
      ),
    ).rejects.toThrow("outbox unavailable");
    expect(
      await harness.connections.platform
        .collection("outbox_events")
        .countDocuments({ organizationId: world.organizationA }),
    ).toBe(beforeOutbox);
    expect(
      await harness.connections.tenantShared
        .collection("audit_logs")
        .countDocuments({ organizationId: world.organizationA }),
    ).toBe(beforeAudit);
    const journals = await world.alice.call("get", world.path + "/journal");
    expect(journals.body.data).toHaveLength(0);
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "bookkeeping.manualEntryOwnerWithoutApproval", value: false }],
    });
    expect((await post(world.alice, world.path, { ...body, approvalToken })).status).toBe(200);
  });
  it("posts one journal for concurrent duplicate delivery and one reversal for concurrent corrections", async () => {
    const world = await worldWithBooks();
    const body = entry(world.account("CASH"), world.account("OWNER_EQUITY"));
    const key = newId();
    const results = await Promise.all([
      post(world.alice, world.path, body, key),
      post(world.alice, world.path, body, key),
    ]);
    expect(results.some((result) => result.status === 200)).toBe(true);
    const rows = await world.alice.call("get", world.path + "/journal");
    expect(rows.body.data).toHaveLength(1);
    const original = rows.body.data[0];
    const reverse = () =>
      world.alice.callWith({
        method: "post",
        path: world.path + "/journal/" + original.journalEntryId + "/reverse",
        body: { businessDate: body.businessDate },
        idempotencyKey: newId(),
      });
    const corrections = await Promise.all([reverse(), reverse()]);
    expect(corrections.map((result) => result.status).sort()).toEqual([200, 409]);
    const after = await world.alice.call("get", world.path + "/journal");
    expect(after.body.data).toHaveLength(2);
  });
});
describe("statement location access", () => {
  it("requires organization-wide grants for the statements", async () => {
    const world = await worldWithBooks();
    const role = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
      name: "Statement reader",
      permissionKeys: [PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ],
    });
    expect(role.status).toBe(201);
    const reader = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: role.body.data.roleId },
    ]);
    const path = world.path + "/statements/profit-and-loss?from=2026-10-01&to=2026-10-20";
    expect((await reader.actor.call("get", path)).status).toBe(403);
    expect((await reader.actor.call("get", path + "&locationId=" + world.locationA1)).status).toBe(
      403,
    );
    expect((await world.alice.call("get", path)).status).toBe(200);
  });
});
describe("delegated journal permission", () => {
  it("requires an approval token bound to a non-owner requester and the approval location", async () => {
    const world = await worldWithBooks();
    const body = {
      ...entry(world.account("CASH"), world.account("OWNER_EQUITY")),
      locationId: world.locationA1,
    } as ManualJournalEntryRequest;
    const ownerToken = await approvalFor(world, body);
    const createdRole = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
      name: "Journal writer",
      permissionKeys: [PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL],
    });
    expect(createdRole.status).toBe(201);
    const writer = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: createdRole.body.data.roleId },
    ]);
    expect((await post(writer.actor, world.path, body)).status).toBe(403);
    expect(
      (await post(writer.actor, world.path, { ...body, approvalToken: ownerToken })).status,
    ).toBe(403);
    const approvers = await writer.actor.call(
      "get",
      `/orgs/${world.organizationA}/approvers?locationId=${world.locationA1}`,
    );
    const ownerApprover = approvers.body.data.find(
      (row: { displayName: string; hasPin: boolean }) => row.hasPin,
    );
    expect(ownerApprover).toBeDefined();
    const subjectKey =
      "manual:" + createHash("sha256").update(manualJournalContent(body)).digest("hex");
    const request = {
      action: "MANUAL_JOURNAL",
      subjectKey,
      amount: money(10000),
      locationId: world.locationA1,
      approverMemberId: ownerApprover.memberId,
      pin: "1234",
    };
    const wrongLocation = await writer.actor.call(
      "post",
      `/orgs/${world.organizationA}/approvals`,
      { ...request, locationId: world.locationA2 },
    );
    expect(wrongLocation.status).toBe(200);
    expect(
      (
        await post(writer.actor, world.path, {
          ...body,
          approvalToken: wrongLocation.body.data.approvalToken,
        })
      ).status,
    ).toBe(403);
    const grant = await writer.actor.call(
      "post",
      `/orgs/${world.organizationA}/approvals`,
      request,
    );
    expect(grant.status).toBe(200);
    expect(
      (
        await post(writer.actor, world.path, {
          ...body,
          approvalToken: grant.body.data.approvalToken,
        })
      ).status,
    ).toBe(200);
  });
});

async function postAutomaticDrafts(
  organizationId: string,
  drafts: ReturnType<typeof draftBookingCompleted>,
): Promise<void> {
  await runInOrganizationContext(organizationId, () =>
    withTransaction(async () => {
      const dependencies = {
        accounts: new MongoAccountRepository(),
        journals: new MongoJournalRepository(),
        audit: buildAuditRecorder(harness.clock),
        clock: harness.clock,
        events: kernelEventPublisher,
      };
      for (const draft of drafts)
        await postJournalEntry(dependencies, {
          organizationId: asId<OrganizationId>(organizationId),
          actorUserId: null,
          draft,
        });
    }),
  );
}
