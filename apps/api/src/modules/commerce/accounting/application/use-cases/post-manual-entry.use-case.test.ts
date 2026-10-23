import { ERROR_CODE, type CurrencyCode } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import {
  consumeJournalApproval,
  type PostManualEntryDependencies,
} from "./post-manual-entry.use-case.js";

const organizationId = asId<OrganizationId>(newId());
const requestedByUserId = asId<UserId>(newId());

function buildDependencies(currency: string | undefined) {
  const consume = vi.fn(async () => undefined);
  const deps = {
    approvals: { consume },
    currencies: { read: async () => currency as CurrencyCode | undefined },
    policy: { ownerMaySkip: async () => false },
  } as unknown as PostManualEntryDependencies;
  return { deps, consume };
}

const expected = {
  organizationId,
  requestedByUserId,
  locationId: "ALL",
  token: "approval-token",
  subjectKey: "manual:abc",
  amount: 12500,
};

describe("consumeJournalApproval", () => {
  it("consumes the approval with the amount in the organization's currency", async () => {
    // CURRENCY_CODE is BDT-only at launch; a second code proves the amount is not a literal.
    const { deps, consume } = buildDependencies("USD");
    await consumeJournalApproval(deps, expected);
    expect(consume).toHaveBeenCalledWith(
      "approval-token",
      expect.objectContaining({
        action: APPROVAL_ACTION.MANUAL_JOURNAL,
        amount: { amount: 12500, currency: "USD" },
      }),
    );
  });

  it("refuses with INTERNAL when the organization has no currency", async () => {
    const { deps, consume } = buildDependencies(undefined);
    await expect(consumeJournalApproval(deps, expected)).rejects.toMatchObject({
      code: ERROR_CODE.INTERNAL,
    });
    expect(consume).not.toHaveBeenCalled();
  });
});
