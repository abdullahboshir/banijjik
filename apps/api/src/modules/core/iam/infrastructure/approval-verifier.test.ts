import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { asId, newId, type MemberId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, withTransaction } from "../../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../../kernel/db/index.js";
import { systemClock } from "../../../../kernel/time/index.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { ApprovalVerifier } from "../application/approval-verifier.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { MongoApprovalTokenRepository } from "./mongo-approval-token.repository.js";
import { RandomApprovalTokens } from "./random-approval-tokens.js";
import { registerIamModels } from "./register-iam-models.js";

registerIamModels();

const organizationId = asId<OrganizationId>(newId());
const approverMemberId = asId<MemberId>(newId());
const requestedByUserId = asId<UserId>(newId());

let connections: DatabaseConnections;
const clock = systemClock;
const tokens = new MongoApprovalTokenRepository();
const secrets = new RandomApprovalTokens();
const audit: AuditRecorder = {
  record: async () => undefined,
};

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

async function issueToken(overrides: {
  action?: (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];
  subjectKey?: string;
  amount?: { amount: number; currency: "BDT" };
  expiresAt?: Date;
}): Promise<string> {
  const issued = secrets.issue();
  const now = clock.now();
  await withOrganizationContext(organizationId, async () => {
    await tokens.insert({
      organizationId,
      tokenHash: secrets.hash(issued.token),
      action: overrides.action ?? APPROVAL_ACTION.REFUND,
      subjectKey: overrides.subjectKey ?? "order:1",
      amount: overrides.amount,
      approverMemberId,
      requestedByUserId,
      expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 120_000),
      createdByUserId: requestedByUserId,
      now,
    });
  });
  return issued.token;
}

describe("ApprovalVerifier.consume", () => {
  it("consumes the exact action and subject once", async () => {
    const token = await issueToken({});
    const verifier = new ApprovalVerifier({ tokens, tokenSecrets: secrets, audit, clock });
    const first = await withOrganizationContext(organizationId, () =>
      withTransaction(() =>
        verifier.consume(token, {
          action: APPROVAL_ACTION.REFUND,
          subjectKey: "order:1",
        }),
      ),
    );
    expect(first.approverMemberId).toBe(approverMemberId);
    await expect(
      withOrganizationContext(organizationId, () =>
        withTransaction(() =>
          verifier.consume(token, {
            action: APPROVAL_ACTION.REFUND,
            subjectKey: "order:1",
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("fails an expired token and a different action, subject or higher amount", async () => {
    const verifier = new ApprovalVerifier({ tokens, tokenSecrets: secrets, audit, clock });
    const expired = await issueToken({
      expiresAt: new Date(clock.now().getTime() - 1_000),
    });
    await expect(
      withOrganizationContext(organizationId, () =>
        withTransaction(() =>
          verifier.consume(expired, {
            action: APPROVAL_ACTION.REFUND,
            subjectKey: "order:1",
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    const withAmount = await issueToken({
      subjectKey: "order:2",
      amount: { amount: 500, currency: "BDT" },
    });
    await expect(
      withOrganizationContext(organizationId, () =>
        withTransaction(() =>
          verifier.consume(withAmount, {
            action: APPROVAL_ACTION.DISCOUNT,
            subjectKey: "order:2",
            amount: { amount: 100, currency: "BDT" },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(
      withOrganizationContext(organizationId, () =>
        withTransaction(() =>
          verifier.consume(withAmount, {
            action: APPROVAL_ACTION.REFUND,
            subjectKey: "order:other",
            amount: { amount: 100, currency: "BDT" },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(
      withOrganizationContext(organizationId, () =>
        withTransaction(() =>
          verifier.consume(withAmount, {
            action: APPROVAL_ACTION.REFUND,
            subjectKey: "order:2",
            amount: { amount: 600, currency: "BDT" },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("accepts a lower amount and leaves the token unused when the caller rolls back", async () => {
    const verifier = new ApprovalVerifier({ tokens, tokenSecrets: secrets, audit, clock });
    const token = await issueToken({
      subjectKey: "order:3",
      amount: { amount: 500, currency: "BDT" },
    });
    await withOrganizationContext(organizationId, () =>
      withTransaction(() =>
        verifier.consume(token, {
          action: APPROVAL_ACTION.REFUND,
          subjectKey: "order:3",
          amount: { amount: 200, currency: "BDT" },
        }),
      ),
    );

    const retryToken = await issueToken({
      subjectKey: "order:rollback",
      amount: { amount: 100, currency: "BDT" },
    });
    await expect(
      withOrganizationContext(organizationId, async () =>
        withTransaction(async () => {
          await verifier.consume(retryToken, {
            action: APPROVAL_ACTION.REFUND,
            subjectKey: "order:rollback",
            amount: { amount: 50, currency: "BDT" },
          });
          throw new Error("abort");
        }),
      ),
    ).rejects.toThrow("abort");

    const second = await withOrganizationContext(organizationId, () =>
      withTransaction(() =>
        verifier.consume(retryToken, {
          action: APPROVAL_ACTION.REFUND,
          subjectKey: "order:rollback",
          amount: { amount: 50, currency: "BDT" },
        }),
      ),
    );
    expect(second.approverMemberId).toBe(approverMemberId);
  });
});
