import { ERROR_CODE } from "@banijjik/contracts";
import { CREDIT_PURCHASE_METHOD, CREDIT_RULE_KEY } from "@banijjik/contracts/credit";
import { asId, newId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import { runWithRequestContext } from "../../../../../kernel/context/index.js";
import { CreditPurchase } from "../../domain/index.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { VerifyCreditPurchaseUseCase } from "./verify-credit-purchase.use-case.js";

const organizationId = asId<OrganizationId>(newId());

function bdtPurchase(): CreditPurchase {
  return CreditPurchase.create({
    organizationId,
    purchaseNumber: "CP-000001",
    customerAccountId: asId<CustomerAccountId>(newId()),
    creditPackId: newId(),
    snapshot: {
      name: { bn: "প্যাক", en: "Pack" },
      credits: 10,
      price: { amount: 500, currency: "BDT" },
      validityDays: null,
    },
    method: CREDIT_PURCHASE_METHOD.BKASH,
    senderPhoneE164: "+8801711000000",
    transactionReference: "TRXUSD0001",
    submittedAt: new Date("2026-10-10T08:00:00.000Z"),
    expiresAt: new Date("2026-10-17T08:00:00.000Z"),
  });
}

/** Only the ports the approval check touches; the use case stops before any write. */
function buildDeps(
  purchase: CreditPurchase,
  input: { readonly threshold: number; readonly organizationCurrency: string },
): CreditDependencies {
  const partial = {
    purchases: { findById: vi.fn(async () => purchase) },
    users: { findIdentifiers: vi.fn(async () => undefined) },
    resolveSettings: vi.fn(
      async () => new Map([[CREDIT_RULE_KEY.PURCHASE_APPROVAL_ABOVE, { value: input.threshold }]]),
    ),
    currency: { read: vi.fn(async () => input.organizationCurrency) },
    unitOfWork: { run: vi.fn() },
  };
  return partial as unknown as CreditDependencies;
}

function verifyWithoutToken(deps: CreditDependencies, purchase: CreditPurchase): Promise<unknown> {
  const verify = new VerifyCreditPurchaseUseCase(deps);
  return runWithRequestContext({ requestId: newId(), organizationId }, () =>
    verify.execute({
      creditPurchaseId: purchase.creditPurchaseId,
      version: purchase.version,
      actorUserId: newId(),
      isOwner: false,
    }),
  );
}

describe("VerifyCreditPurchaseUseCase approval threshold", () => {
  it("asks for an approval token when the price is above the threshold", async () => {
    const purchase = bdtPurchase();
    const deps = buildDeps(purchase, { threshold: 400, organizationCurrency: "BDT" });

    await expect(verifyWithoutToken(deps, purchase)).rejects.toMatchObject({
      code: ERROR_CODE.APPROVAL_REQUIRED,
    });
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it("asks for an approval token when the price is not in the organization's currency", async () => {
    const purchase = bdtPurchase();
    // 10 000 000 minor units is far above 500, so only the currency mismatch can require approval.
    const deps = buildDeps(purchase, { threshold: 10_000_000, organizationCurrency: "USD" });

    await expect(verifyWithoutToken(deps, purchase)).rejects.toMatchObject({
      code: ERROR_CODE.APPROVAL_REQUIRED,
    });
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });
});
